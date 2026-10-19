# 2026-10-19 · 주간 보스 "그림자" PR 1 — 백엔드

설계: [docs/design/shadow-boss.md](../design/shadow-boss.md). 캐릭터 레벨이 보여 주는 용도뿐이라 성장에 쓸모를 주는 첫 단계.
그림자 = 지난 4주 평균 활동량으로 선 개인 보스. 이번 주 운동 세션 · 러닝이 공격, 자기 기록 갱신(PR · 러닝 기록)이 치명타, 처치하면 점수 +10 · 상자 1 · 칭호.
이 PR 은 서버만(표 2 · 규칙 · 서비스 · API · 저장 응답 · 칭호 · 탈퇴). 화면은 PR 2(전투 장면) · PR 3(그림자 화면 · 공유).

8절 "결정이 필요한 것"은 기본값으로 갔다: 이름 **그림자** · 맨몸 **20kg/회** · 하루 상한 **300** · 처치 상자 **1개**. 숫자는 모두 `ShadowRules` 한 곳.

## 1. 데이터 — `entity/ShadowWeek.java` · `entity/ShadowHit.java`

- `shadow_weeks`(한 사람의 한 주): `user_id, week_start, hp, damage, hits, crits, killed_at, rewarded, level_at_start, rest` + `UNIQUE(user_id, week_start)`.
- `shadow_hits`(공격 한 번): `week_id, user_id, source(VARCHAR SESSION|RUN), source_id, hit_on(DATE), raw, damage, crit, hp_after` + `INDEX(source, source_id)`.
  - 설계 3절 표에 **`hit_on` 한 칸을 더했다**: 하루 상한을 셀 때 "오늘" 공격을 골라야 하는데 `created_at` 은 JPA 감사(서버 시계)라
    `Clock` 을 고정한 테스트 · 시간대 경계에서 흔들린다. `hit_on` 은 `LocalDate.now(clock)`(KST).
  - `source` 는 문자열(enum 칸 없음 → DB 제약 이전 SQL 불필요, CLAUDE.md 함정). `source_id` 는 외래키가 아니다(지울 때 `onDeleted` 로 같이 지움).
- 리포지토리 2개: `ShadowWeekRepository`(주 하나 · 범위 · 처치 수) · `ShadowHitRepository`(주의 공격들 · 출처로 찾기 · `sumRawByWeekAndDay`).
- 새 표뿐이라 `ddl-auto=update` 로 생긴다. Flyway 이전 SQL 없음.

## 2. 규칙 — `service/ShadowRules.java` (상수 + 순수 함수)

| 함수 | 규칙 | 예 |
|---|---|---|
| `sessionForce(volume, bodyweightReps)` | (볼륨 + 맨몸 횟수 × 20kg) ÷ 100, 반올림 | 6,000kg → 60 · 턱걸이 8회 3세트 → 480 → 5 |
| `runForce(distanceM)` | 거리 ÷ 100 | 5.2km → 52 |
| `capped(force, alreadyToday)` | 하루 상한 300 — 오늘 이미 들어간 힘(상한 전 값)만큼 뺀 나머지 | 150 + 150 + 100 → 세 번째 0 |
| `critMultiplier(level)` · `damage(...)` | 치명타 × (1.5 + 레벨 × 0.01), 반올림. 평상 공격은 그대로 | Lv20 → ×1.7, 60 → 102 |
| `hp(recent4Damages)` | max(100, round(힘 > 0 인 주 평균 × 1.05)) | [0, 300, 500, 0] → 420 |
| `remaining` · `overkillPct` | 남은 체력(0 바닥) · 처치 뒤 더 들어간 % | 120/100 → 20% |
| `streakWeeks(weeks, thisWeek)` | 이번 주는 잡았을 때만, 지난주부터 거꾸로 잡은 주 수. 휴식 주는 건너뜀, 행 없는 주 · 놓친 주에서 멈춤 | |

- `MIN_FORCE = 1`: 힘 1 미만은 공격이 아니다(1분짜리 저장 막기).
- 상한은 **치명타 전** 힘에 걸린다(치명타 배율은 상한 뒤). 상한 때문에 0 이 된 공격도 행으로 남긴다(raw 는 그대로, damage 0) — 화면이 "오늘 상한"을 보여 줄 수 있게.

## 3. 서비스 — `service/ShadowBossService.java`

- `status(user)`: 이번 주 행을 찾거나 만든다(스케줄러 없음, 주간 목표와 같은 방식) → `ShadowStatusResponse`. 공격 목록은 저장된 순서대로 되감아 공격 전후 체력 · 처치 여부를 채운다.
- `history(user, weeks)`: 최근 n 주(1~52) 행만, 최근 순. 행이 없는 주(운동 안 한 주)는 없다 — 화면이 "놓침"으로 채운다.
- `onSession(user, session, hasPr)`: 세트의 종목을 `ExerciseCatalog.describe` 로 보고 맨몸 종목 횟수를 센다 → `attack(SESSION)`.
- `onRun(user, run, hasRecord)` → `attack(RUN)`.
- `attack`: 힘 → 오늘 상한 → 치명타(기록 갱신 && 힘 > 0, 세션당 한 번) → 주 합계 갱신 → 처치 판정 → 공격 행 저장 → 응답.
  - 처치 = `killed_at == null && !rest && damage >= hp`. **휴식 주**(`WeeklyGoalWeek.rest`)는 힘은 쌓이되 처치되지 않고(보상도 없음) 연속도 끊기지 않는다.
  - 보상(`rewarded` 한 주 한 번): `CharacterGrowthService.applyAttendance(user, 10)` · `CollectionService.grantBox(user, "SHADOW")` · `CollectionService.unlockAchievements(user)`(칭호).
  - 치명타 배율의 레벨은 `level_at_start`(주가 시작될 때 `CharacterProfile.level`, 없으면 1) — 주 안에서 고정.
- `onDeleted(source, id)`: 그 출처의 공격 행을 지우고 주 합계(damage · hits · crits · 각 공격의 hp_after)를 다시 계산. `killed_at` · `rewarded` 는 그대로(보상 회수 X).
- 주 경계는 `WeeklyGoalService.weekStart`(월요일, `public static` 으로 열었다), 시간은 `TimeConfig` 의 `Clock`.
- 휴식 여부는 상태를 볼 때마다 주간 목표의 휴식 주를 따라간다(처치한 뒤에는 고정).

## 4. API — `controller/ShadowController.java` · `dto/shadow/*` · `SecurityConfig`

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/shadow` | `ShadowStatusResponse { name, weekStart, weekEnd, rest, hp, damage, remaining, killed, killedAt, overkillPct, level, hits:[Hit], streakWeeks, lastWeek:{hp,damage,killed,rest}\|null }` |
| GET | `/api/shadow/history?weeks=8` | `[ShadowHistoryItem { weekStart, hp, damage, killed, rest }]` |
| POST | `/api/workouts` · `/api/runs` | 응답에 `shadow: Hit \| null` |

```
Hit = ShadowHitResponse { id, source, hitOn, hp, raw, damage, crit, hpBefore, hpAfter, killed, overkillPct,
                          reward: { points, box, titles:[String] } | null }
```

- `killed` 는 **이 공격으로** 처치했는지(처치 연출은 이때만). 이미 잡힌 뒤의 공격은 `killed=false`, `hpBefore=0`, `overkillPct` 만 오른다.
- 설계 4절보다 더한 칸: `name`(이름을 서버가 정함 — 8절 1번) · `level`(치명타 배율 설명용) · `lastWeek.rest` · `HistoryItem.rest`.
- (PR 2 에서) `Hit.hp`(이번 주 체력 — 바의 전체 길이) · `Hit.hitOn`(공격한 날 — 목록의 요일).
- 응답에 이메일 · 사용자 번호 없음(테스트에서 `@test.local` 이 본문에 없는지 확인). 다른 사람 그림자는 보여 주지 않는다.
- `SecurityConfig`: `/api/shadow/**` 는 `USER` · `ADMIN`.

## 5. 고친 기존 코드

- `WorkoutSessionService` — `SaveResult` 에 `ShadowHitResponse shadow` 칸, `save` 끝에 `shadowBossService.onSession(me, saved, !prs.isEmpty())`, `delete` 에 `onDeleted(SESSION, id)`.
  ```diff
  -        return new SaveResult(detail(saved), prs, statUpdates, points, attendance);
  +        ShadowHitResponse shadow = shadowBossService.onSession(me, saved, !prs.isEmpty());
  +        return new SaveResult(detail(saved), prs, statUpdates, points, attendance, shadow);
  ```
- `RunService` — 같은 모양(`onRun(me, run, !records.isEmpty())`, `delete` 에 `onDeleted(RUN, id)`).
- `WeeklyGoalService.weekStart` — `static` → `public static`.
- `CollectionItem` — 칭호 `T_SHADOW_1`("그림자를 넘은 자", RARE, 업적 `SHADOW_1`) · `T_SHADOW_STREAK_4`("그림자 사냥꾼", EPIC, 업적 `SHADOW_STREAK_4`). 코드는 저장되므로 바꾸지 않는다.
- `CollectionService` — `grantBox(user, source)`(지갑 잠그고 상자 +1) · `unlockAchievements(user)` 공개 · `Counters` 에 `SHADOW_1`(처치 수 = `killed_at` 있는 주) · `SHADOW_STREAK_4`(`ShadowRules.streakWeeks`).
  ```diff
  +                case SHADOW_1 -> (int) shadowWeekRepository.countByUser_IdAndKilledAtIsNotNull(me.getId());
  +                case SHADOW_STREAK_4 -> shadowStreak();
  ```
- `AccountDeletionService` — `ShadowHit` · `ShadowWeek` 삭제(주간 목표 다음 줄).
- `AccountSafetyTest` — 탈퇴 전에 두 표에 행을 넣고 탈퇴 뒤 0행 확인.

## 6. 확인 — `service/ShadowBossServiceTest.java`(12개, 오늘 2026-10-15 목 고정)

7절 "PR 1 테스트" 항목 전부:
- 지난 기록 없음 → HP 100 · 빈 상태, 상태만 봐도 이번 주 행이 생김 / 최근 4주 [0, 300, 500, 0] → 420, 5주 전은 무시.
- 볼륨 6,000 → 60 · 맨몸 턱걸이 8회 3세트 → 5 / 힘 1 미만(러닝 40m · 볼륨 30kg) → 공격 없음.
- 하루 상한: 150 + 150 + 100 → 세 번째 0(행은 남음, raw 100).
- Lv20 + PR → ×1.7(60 → 102) / API: PR 3개 세션(볼륨 2,800)도 치명타 한 번(28 → 42, Lv1 ×1.51), 지우면 공격 · 합계 사라짐.
- 처치 → 보상 1회(점수 +10 · 상자 +1 · 칭호 SHADOW_1 실제 반영), 같은 주 세 번째 공격은 오버킬 80% 만 / 4주 연속 처치 → "그림자 사냥꾼".
- 세션 삭제 → 공격 삭제 · 합계 재계산, `killed_at` · `rewarded` 유지.
- 휴식 주 → 150 들어가도 처치 안 됨 · 보상 없음 · 연속 3 유지(처치 · 처치 · 휴식 · 처치), 전적 5주 / 놓친 주 · 행 없는 주는 연속을 끊음.
- API: `GET /api/shadow` · `/history` 모양, 본문에 이메일 없음, 로그인 없으면 4xx / `POST /api/runs` 5.2km → `shadow.raw 52 · crit · damage 79`.

실행: `cmd //c "set SPRING_PROFILES_ACTIVE=test&& backend\gradlew.bat -p backend test"` — 작업 폴더가 git worktree 라 gitignore 된 `application-local.properties` 가 없어
`local` 대신(같은 로컬 MySQL 을 가리키는) `test` 프로필로 돌렸다. 백엔드 전체 95개 통과. `verify.sh` 통과(화면 코드 변경 없음).

로컬 서버(`local` 프로필, 미리보기 서버)에서 시험용 계정으로 실제 호출: `GET /api/shadow` → `hp 100`, `POST /api/workouts`(스쿼트 100×5 ×3 + 턱걸이 8회 ×2 = 볼륨 1,500 + 맨몸 320) →
`shadow { raw 18, crit true(첫 PR), damage 27, hpBefore 100, hpAfter 73 }`, `GET /api/shadow` → `damage 27 · hits 1`, `/history?weeks=8` → 1주, 로그인 없이 401, `DELETE /api/workouts/{id}` → `damage 0 · hits []`.
MySQL 에 `shadow_weeks` · `shadow_hits` 가 설계대로 생겼다(UNIQUE · INDEX 포함). 시험용 계정과 관련 행은 SQL 로 지웠다.

## 7. 남은 것 (다음 PR)

- PR 2 화면: `BossFight` · `ShadowSprite` · 홈 카드 줄 · `/dev/boss`. `lib/workoutSession.ts` · `lib/running.ts` 응답 타입에 `shadow`.
- PR 3: `/shadow` 화면 · 전적 · 처치 공유 카드.
- 2차: 일요일 푸시(`PushService.PushEvent`), 꾸미기 `GymDecorItem.Goal.SHADOW_KILLS`, 홈 지도에 그림자 NPC.
- 튜닝: 맨몸 20kg/회 · 상한 300 · HP 바닥 100 은 한 주 써 보고 `ShadowRules` 에서 바꾼다.
