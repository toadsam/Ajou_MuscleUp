# 설계 — 주간 보스 "그림자": 캐릭터 성장에 쓸모를 주는 첫 단계

2026-10-19 초안. **아직 코드 변경 없음 — 이 설계를 확정한 뒤 PR 단위로 진행한다.**
근거(`파일:줄`)는 2026-10-19 `main`(`160d9a4`) 기준.

---

## 0. 왜 만드나

- 지금 캐릭터는 레벨 · 티어(브론즈~챌린저) · 진화 단계 · 칭호가 쌓이지만, 그게 쓰이는 곳은 **보여 주는 데**뿐이다
  (랭킹 · 친구 목록 · 광장 · 캐릭터 카드). 성장이 "다음에 뭘 할 수 있는가"를 바꾸지 않는다 → 성장이 곧 결말.
- RPG 처럼 **성장 → 더 센 상대 → 보상**의 고리를 만든다. 다만 헬스 동아리라서 지켜야 할 것:
  1. 운동 중에 화면을 보게 하지 않는다(러닝 중 전투 X). 연출은 **끝난 뒤**.
  2. 절대 페이스 · 절대 무게로 재지 않는다(초보 무리 · 고수 지루). **자기 기록 대비**로 잰다.
  3. 해야 할 숫자를 늘리지 않는다. 일일 퀘스트 · 주간 목표 · 모임 챌린지가 이미 있다.
- 첫 단계는 **개인 보스 하나**("그림자" = 지난 나). 모임 보스 · 보스 고르기 · 진짜 몬스터는 이게 재미있는지 본 뒤.

대화에서 정한 방향(2026-10-19): 개인 보스 = 과거의 나 / 데미지 공식은 하나(나중에 모임 보스도 같은 공식) /
연출은 공격 · 치명타 · 처치 세 장면, 처치에만 힘을 준다 / 첫 보스는 **새 그림이 필요 없는** 그림자.

---

## 1. 지금 상태 (조사 결과)

| 영역 | 지금 | 이번 설계에서 쓰는 방법 |
|---|---|---|
| 운동 세션 저장 | `WorkoutSessionService.save` (`service/WorkoutSessionService.java:82-176`): 총 볼륨(`totalVolume` = Σ 무게×횟수) · 세트 수 계산, 종목별 최고 세트로 `LiftService.record` → **개인 최고(PR)** 판정 · 점수, 출석 처리. 응답 `SaveResult(session, prs, statUpdates, points, attendance)` | 저장 끝에 그림자 공격을 붙이고 응답에 `shadow` 칸을 더한다 |
| 러닝 저장 | `RunService.save` (`service/RunService.java:85-168`): 거리 · 구간 · 1/5/10km 최고 · **기록 갱신(`records`)** · 기록 점수(하루 상한) · 출석. 응답 `SaveResult(run, records, points, attendance)` | 같은 방식 |
| 주(週) | `WeeklyGoalService.weekStart` = 월요일(`service/WeeklyGoalService.java:139`), KST `Clock`(`TimeConfig`). `WeeklyGoalWeek`(목표 일수 · 휴식 주 `rest` · `rewarded`) | 같은 주 경계 · 같은 휴식 규칙을 쓴다 |
| 캐릭터 성장 | 레벨 = `1 + floor(totalScore)`, 최대 100(`CharacterServiceImpl.java:285`). 점수는 출석 `applyAttendance(user, points)`(`CharacterGrowthService.java:23`) 로만 오른다 | 처치 보상 점수는 `applyAttendance` 로 넣는다(새 경로 X) |
| 보상 창고 | `CollectionService`: 상자(`boxes`) · 조각 · 칭호/민소매/테두리(`CollectionItem` enum, 업적 `Achievement`), `onWorkoutDay` 가 주간 목표 달성 때 상자 `WEEKLY_GOAL` | 처치 = 상자 1개 + 새 칭호 2개 |
| 꾸미기 | `GymDecorItem.Goal`(출석 n일 · 러닝 n km …)로 얻는 조건 계산(저장 안 함) | 2차에서 `SHADOW_KILLS` 조건 추가 |
| 운동 중 캐릭터 | `LiftStage`(`components/workout/LiftStage.tsx`): 세트 끝날 때 `cue`(set · pr · first)로 캐릭터가 종목 동작을 한다. 동작 데이터 `lib/liftMotion.ts`, 2프레임 `PixelAction` | 전투 장면의 "공격" 동작에 그대로 재활용 |
| 아바타 그림 | `buildPixelAvatar(spec)`(`components/avatar/pixelAvatar.ts:141`), `spec.colors {skin, hair, tank}` · `action` · `pumped` | **그림자 = 같은 spec 에 어두운 색**. 새 픽셀 아트 0장 |
| 결과 화면 | 운동: `pages/WorkoutSession.tsx:334-` (펌핑 아바타 · PR 목록 · 점수 · 출석). 러닝: `pages/Running.tsx:425-` (새 기록 · 공유 카드 버튼) | 여기 맨 위에 전투 장면 |
| 홈 | `pages/Home.tsx`: `GymMap` + 주간 목표 상태(`weeklyGoal`) | 주간 목표 카드에 그림자 체력 바를 **같은 카드**로 |
| 연출 부품 | `index.css`: `.dg-pop` `.dg-rise` `.dg-plate-in` `dgChalk`(초크) `dg-box-shake`(상자), `CountUp` | 그대로 쓰고, 새로 2개(피격 흔들림 · 무너짐) |
| 공유 카드 | `lib/photoCard.ts` + `components/share/PhotoShareEditor.tsx`(캔버스 직접 그림, html2canvas 금지) | 처치 카드도 같은 길 |
| 탈퇴 | `AccountDeletionService` 가 개인 데이터 표를 일괄 삭제, `AccountSafetyTest` 로 확인 | 새 표 2개를 넣는다 |
| 개발 확인 화면 | `/dev/avatars`(로그인 없이, `App.tsx:91`) | `/dev/boss` 를 같은 방식으로 |

**설계가 피해 가는 함정(CLAUDE.md)**: enum 칸 대신 문자열(DB 제약 이전 불필요) · `LocalDate.now()` 대신 `Clock` ·
응답에 이메일 X · 푸시는 `PushService.PushEvent` · 움직임 ≤600ms 단위 · 유리 · 블러 · 네온 X.

---

## 2. 규칙 (게임 디자인)

### 2.1 한 주 = 그림자 한 마리

- 월요일 00:00(KST) 새 그림자가 선다. 일요일 24:00 까지 못 잡으면 "놓침". 잡으면 남은 요일은 **"오버킬 %"** 만 쌓인다(보상 없음 — 무리 유도 X).
- **휴식 주**(`WeeklyGoalWeek.rest = true`)는 그림자가 **잠든다**: 체력 바 대신 "이번 주는 쉬어요", 연속 기록이 끊기지 않는다.
- 처음 쓰는 주(지난 기록 없음): 체력 **100**(아래 바닥값).

### 2.2 힘(데미지) — 단위 하나

운동과 러닝을 같은 단위 "힘"으로 환산한다. 숫자는 **튜닝 상수**(`ShadowRules` 한 곳).

| 활동 | 힘 | 예 |
|---|---|---|
| 운동 세션 | `totalVolume ÷ 100` (kg·회) | 5,000kg → 50 |
| 맨몸 종목 세트 | 세션 볼륨에 `횟수 × 20kg` 로 더한다(지금은 무게 0 이라 볼륨 0) | 턱걸이 8회 → 160kg → 1.6 |
| 러닝 | `distanceM ÷ 100` | 5km → 50 |
| 하루 상한 | **300** (세 번째 세션부터는 안 들어감 — 수기 입력 부풀리기 막기) | |
| 세션 최소 | 힘 1 미만이면 공격 안 함(1분짜리 저장 막기) | |

보통 세션(3,000~8,000kg) ≈ 30~80, 보통 러닝(3~8km) ≈ 30~80 으로 **둘이 비슷한 무게**가 되게 잡았다.

### 2.3 그림자 체력 — 지난 나

```
HP = max(100, round(평균(최근 4주 중 힘 > 0 인 주의 힘 합계) × 1.05))
```

- 4주 평균이라 한 주 몰아친 뒤에도 다음 주가 절망적이지 않다. `× 1.05` 는 "그림자는 늘 조금 더 세다".
- 지난주 힘 합계는 **그 주의 `shadow_weeks.damage`** 를 쓴다(다시 계산 X).
- 바닥 100 = 러닝 5km 두 번, 또는 보통 세션 두 번. "주 2회면 턱걸이" 수준.

### 2.4 치명타 — 자기 기록을 깼을 때만

- 세션에 **PR(`LiftService.Pr`) 하나 이상** 또는 러닝 **기록 갱신(`RunService.Record`) 하나 이상** → 그 공격의 힘 `× (1.5 + 레벨 × 0.01)`.
  (Lv1 ×1.51, Lv50 ×2.0). 세션당 한 번만(PR 3개여도 ×1 배율).
- 여기서 **레벨이 처음으로 "할 수 있는 것"에 영향**을 준다. 단, 그림자는 "공정한 거울"이라 **평상 공격에는 레벨 배율을 주지 않는다**
  (주면 고레벨이 덜 하고도 이기는 구조가 된다). 레벨 배율이 제대로 빛나는 건 2단계 **모임 보스**(체력이 내 기록이 아니라
  멤버 수로 정해지므로 "내 레벨 = 우리 모임 데미지")와 3단계 **등급 보스**(레벨로 열림)다. 이 문서는 1단계까지.

### 2.5 처치 보상 (한 주 한 번)

| 보상 | 어떻게 | 근거 |
|---|---|---|
| 캐릭터 점수 **+10** | `CharacterGrowthService.applyAttendance(user, 10)` | 주간 목표 보너스와 같은 길 |
| 상자 **1개** | `CollectionService` 지갑 `boxes + 1`, 출처 `SHADOW` | 기존 상자 경제 안 |
| 칭호 "그림자를 넘은 자"(RARE) | `CollectionItem` 새 항목, 업적 `SHADOW_1` | 첫 처치 |
| 칭호 "그림자 사냥꾼"(EPIC) | 업적 `SHADOW_STREAK_4`(4주 연속 처치) | |
| (2차) 꾸미기 "그림자 액자" | `GymDecorItem.Goal.SHADOW_KILLS(n)` | 꾸미기는 조건 계산식이라 처치 수만 세면 됨 |

### 2.6 지우기 · 되돌리기

- 세션 · 러닝을 지우면 그 공격(`shadow_hits`)도 지우고 주 합계를 다시 더한다.
- **이미 처치한 건 되돌리지 않는다**(보상 회수 X, `killed_at` 유지). 숫자만 줄어든다. 단순하고, 악용해도 얻는 게 상자 1개뿐.

### 2.7 레벨과의 관계 요약 (사용자 질문 "성장하면 보상")

| 단계 | 레벨이 하는 일 |
|---|---|
| 1단계 그림자(이 문서) | 치명타 배율(+1%/Lv). 처치 보상으로 레벨이 오른다 |
| 2단계 모임 보스 | 평상 데미지 배율 `1 + Lv × 0.02`. 보스 체력 = 멤버 수 × 상수 |
| 3단계 등급 보스(덤벨 골렘 · 철판 거인…) | 티어로 잠금 해제(실버 → 1등급 …). 보스별 전리품 |

---

## 3. 데이터 구조 (백엔드)

새 표 2개. `ddl-auto=update` 로 생기고, enum 칸이 없어 제약 이전 SQL 이 필요 없다.

```
shadow_weeks                      -- 한 사람의 한 주
  id, user_id(FK), week_start(DATE), hp(INT), damage(INT),
  hits(INT), crits(INT), killed_at(DATETIME null), rewarded(BOOL),
  level_at_start(INT), rest(BOOL), created_at/updated_at
  UNIQUE(user_id, week_start)

shadow_hits                       -- 공격 한 번 (되감기 · 지우기용)
  id, week_id(FK shadow_weeks), user_id(FK), source(VARCHAR: SESSION|RUN),
  source_id(BIGINT), raw(INT), damage(INT), crit(BOOL), hp_after(INT), created_at
  INDEX(source, source_id)
```

- `ShadowWeek` · `ShadowHit` 엔티티(`BaseTimeEntity`), 리포지토리 2개.
- `AccountDeletionService` 에 두 표 삭제 추가 + `AccountSafetyTest` 확인.
- 주 행은 **필요할 때 만든다**(`status()` 또는 첫 공격). 스케줄러 없음(주간 목표와 같은 방식).
- `WeeklyGoalService.weekStart` 를 `public static` 으로 열어 같이 쓴다.

---

## 4. API

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/shadow` | `Status { weekStart, weekEnd, rest, hp, damage, remaining, killed, killedAt, overkillPct, hits:[Hit], streakWeeks, lastWeek:{hp,damage,killed} }` |
| GET | `/api/shadow/history?weeks=8` | `[{ weekStart, hp, damage, killed }]` (전적) |
| (기존) POST | `/api/workouts` · `/api/runs` | 응답에 `shadow: Hit \| null` 추가 |

```
Hit { id, source, raw, damage, crit, hpBefore, hpAfter, killed, overkillPct,
      reward: { points, box, titles:[String] } | null }
```

- 저장 서비스가 직접 부른다(출석과 같은 자리, 응답에 넣어야 하므로 이벤트 버스 X):
  `WorkoutSessionService.save` 끝 → `shadowBossService.onSession(me, saved, !prs.isEmpty())`,
  `RunService.save` 끝 → `onRun(me, run, !records.isEmpty())`. `delete` → `onDeleted("SESSION"|"RUN", id)`.
- 응답에 이메일 · 사용자 번호 없음. 다른 사람의 그림자는 보여 주지 않는다(1단계).
- 2차: 일요일 18:00 "그림자 체력 n 남았어요" → `PushService.PushEvent(type=WEEKLY)`. 1차에는 없음.

새 파일: `entity/ShadowWeek.java` `entity/ShadowHit.java` `repository/ShadowWeekRepository.java` `repository/ShadowHitRepository.java`
`service/ShadowRules.java`(상수 · 공식만, 순수 함수) `service/ShadowBossService.java` `controller/ShadowController.java` `dto/shadow/*`.
고치는 파일: `WorkoutSessionService`(SaveResult 칸 1개 + 호출 2곳) · `RunService`(같음) · `WeeklyGoalService`(weekStart 공개) ·
`CollectionItem`(칭호 2 + 업적 2) · `CollectionService`(상자 출처 `SHADOW`, 업적 카운터) · `AccountDeletionService` · `SecurityConfig`(경로 인증).

---

## 5. 화면

### 5.1 전투 장면 `components/boss/BossFight.tsx`

운동 · 러닝 **결과 화면 맨 위**(PR 목록 위). 입력: `Hit` + 내 캐릭터 + 오늘 대표 동작.

```
┌──────────── dg-rubber ────────────┐
│  [내 캐릭터]          [그림자]     │   24×32 픽셀 둘, 서로 마주 봄
│   오늘 동작 1회        피격 흔들림  │
│  ────────────────────────────    │
│  그림자  ██████████░░░░  412/640  │   .dg-well + plate-red 채움, 숫자는 CountUp
│  오늘 힘 +68   치명타!            │   font-num / font-display
│                      [건너뛰기]   │
└───────────────────────────────────┘
```

**세 장면** (각 동작 ≤600ms, 이어 붙임):

| 장면 | 조건 | 순서 | 시간 |
|---|---|---|---|
| 공격 | 항상 | ① 내 캐릭터가 오늘 대표 종목 동작 1회(`liftMotion` 2프레임, 러닝은 `run` 동작) 600ms → ② 그림자 피격: 색 반전 1프레임 + 좌우 흔들림 300ms(`.dg-hit`, 새 keyframes) → ③ 체력 바 깎임 800ms(`CountUp`, `hpBefore → hpAfter`) → ④ "+68" 숫자 `.dg-rise` | ≈ 2초 |
| 치명타 | `crit` | ②에 초크 터짐(`.dg-chalk-burst` 자동) + 화면 전체 `translate` 흔들림 200ms(`.dg-quake`, 새) + "치명타!" `font-display text-plate-yellow dg-pop` | +0.5초 |
| 처치 | `killed` | ③ 뒤 ⑤ 그림자 무너짐: 아래로 4단계 줄어들며 사라짐 480ms(캔버스 컨테이너 `clip-path` 단계) → ⑥ 원판 조각 6개가 흩어짐 600ms(`dgPlateIn` 반대 방향, 새 `dgShatter`) → ⑦ 전리품 카드 `.dg-pop`(점수 +10 · 상자 · 칭호) → ⑧ 내 캐릭터 `flex` 포즈 → "공유 카드 만들기" 버튼 | +3초 |

- **건너뛰기** 항상 보임(누르면 마지막 상태로). 다시 보기는 홈 카드 → 그림자 화면에서.
- 소리 없음(헬스장). `prefers-reduced-motion` 은 전역에서 꺼져 있어 따로 처리 X(디자인 규칙).
- 금지 규칙 준수: 흰 플래시 · 글로우 · 블러 없음. 피격 색 반전은 `INK` ↔ 바탕 1프레임.

### 5.2 그림자 스프라이트 `components/boss/ShadowSprite.tsx`

- `AvatarRenderer` 와 같은 `spec` 을 만들되 `colors = { skin: steel-800, hair: steel-900, tank: steel-700 }`, 눈 픽셀만 `plate-red`
  (`buildPixelAvatar` 에 `eyeColor` 선택 칸 하나 추가 — 기본값 지금 그대로라 다른 화면 영향 없음).
- 피격 동작: 내 동작과 같은 `action` 을 `frame: 1` 로 고정해 "맞고 버티는" 모습. 새 포즈 데이터 X.
- `/dev/avatars` 에 "그림자" 줄 하나 추가해 확인.

### 5.3 홈 카드 (주간 목표 카드에 합침)

- `pages/Home.tsx` 의 주간 목표 영역에 **같은 카드 안** 두 줄: "이번 주 운동 2/3일" + "그림자 ████░░ 228 남음".
  새 카드를 늘리지 않는다(규칙 3). 누르면 `/shadow`.
- 휴식 주: "그림자가 쉬는 중". 처치 후: "처치! 오버킬 23%".

### 5.4 그림자 화면 `pages/ShadowBoss.tsx` (`/shadow`)

- 위: 전투 장면(마지막 공격을 다시 보기 가능). 가운데: 이번 주 공격 목록(요일 · 출처 · 힘 · 치명타). 아래: 최근 8주 전적(잡음 · 놓침 · 휴식) — 작은 원판 아이콘 줄.
- 규칙 설명 한 문단(힘 환산 · 치명타 · 보상). 개발자 문구 X.

### 5.5 처치 공유 카드 (1차 범위 안, 처치 때만)

- `lib/bossShareCard.ts`: `photoCard.ts` 방식으로 캔버스 직접 그림. 1080×1350. 내 캐릭터(`flex`) + 무너진 그림자 실루엣 + "이번 주 그림자 처치 · 힘 712 · 치명타 2". 워터마크는 왼쪽 위 하나(사용자 결정).
- `PhotoShareEditor` 재사용(사진 고르기 · 위치 · 공유). Web Share 는 버튼 핸들러에서 `await` 없이(함정).

### 5.6 개발 확인 `pages/DevBoss.tsx` (`/dev/boss`, 로그인 없음)

- 가짜 `Hit` 4종(보통 · 치명타 · 처치 · 치명타+처치)과 가짜 캐릭터로 전투 장면을 돌려 본다. 375px 도 여기서.

새 파일: `lib/shadow.ts`(타입 · 경로) `components/boss/BossFight.tsx` `components/boss/ShadowSprite.tsx` `components/boss/HpBar.tsx`
`components/boss/ShadowHomeRow.tsx` `pages/ShadowBoss.tsx` `pages/DevBoss.tsx` `lib/bossShareCard.ts`.
고치는 파일: `WorkoutSession.tsx`(결과 위) · `Running.tsx`(결과 위) · `Home.tsx`(카드 한 줄) · `App.tsx`(라우트 2) · `pixelAvatar.ts`(`eyeColor`) ·
`index.css`(`.dg-hit` `.dg-quake` `dgShatter` 3개) · `lib/workoutSession.ts` · `lib/running.ts`(응답 타입에 `shadow`).

---

## 6. PR 나누기

| PR | 내용 | 끝난 상태 | 크기 |
|---|---|---|---|
| **1. 백엔드** | 표 2 · `ShadowRules` · `ShadowBossService` · API · 저장 응답 `shadow` · 칭호/업적 · 탈퇴 | `GET /api/shadow` 가 뜨고, 세션 저장 응답에 `shadow` 가 온다. 테스트 통과 | M |
| **2. 전투 장면** | `BossFight` · `ShadowSprite` · CSS 3개 · 결과 화면 2곳 · 홈 카드 줄 · `/dev/boss` | 운동 끝내면 공격 → 체력 바가 깎인다. `/dev/boss` 에서 4종 연출 확인 | M |
| **3. 그림자 화면 · 공유** | `/shadow` · 전적 · 처치 공유 카드 | 처치 → 공유 카드까지 한 번에 | S~M |
| (2차) | 홈 지도에 그림자 서 있기(NPC 처럼, 누르면 남은 체력 대사) · 일요일 푸시 · 꾸미기 `SHADOW_KILLS` | | S |

PR 은 **main 기준**으로 각각(쌓지 않는다 — 메모리 `retention-roadmap`).

---

## 7. 확인 방법 (각 PR)

**PR 1 테스트** (`ShadowBossServiceTest`, `local` 프로필):
- 지난 기록 없음 → HP 100. 최근 4주 [0, 300, 500, 0] → HP = round(400 × 1.05) = 420.
- 세션 볼륨 6,000 → 힘 60. 맨몸 턱걸이 8회 3세트 → 480kg → 4.8 → 5.
- 하루 상한: 150 + 150 + 100 → 세 번째는 0.
- PR 있는 세션 Lv20 → ×1.7, PR 3개여도 한 번.
- 처치 → `rewarded` 1회만, 점수 +10 · 상자 +1 · 칭호 `SHADOW_1`. 같은 주 두 번째 공격은 오버킬만.
- 세션 삭제 → 공격 삭제 · 합계 재계산, `killed_at` 유지.
- 휴식 주 → 공격 들어가도 `damage` 는 쌓이되 `killed` 안 됨, 연속 안 끊김.
- `AccountSafetyTest`: 탈퇴 뒤 `shadow_weeks` · `shadow_hits` 0행.

**PR 2 화면**: `bash scripts/verify.sh`, `/dev/boss` 4종을 데스크톱 + 375px 로 스크린샷 → `docs/screenshots/`. 실제 세션 저장은 로그인 필요(사용자가 Google 로그인) — 못 보면 기록에 명시.

**PR 3**: 공유 카드는 Chrome 실기기에서 Web Share 까지(미리보기 브라우저는 파일 공유 불가 → 저장으로만 확인).

**기록**: 각 PR 마다 `docs/fix-log.md` 맨 위 + `docs/fixes/2026-10-xx-shadow-boss-*.md`(코드 단위).

---

## 8. 결정이 필요한 것 (사용자)

1. **이름**: "그림자" 그대로? (후보: 그림자 · 어제의 나 · 섀도우)
2. **맨몸 환산 20kg/회**와 **하루 상한 300** — 숫자 감이 맞는지. 직접 한 주 돌려 보고 바꿔도 된다(상수 한 곳).
3. **처치 보상에 상자 1개**: 지금 상자는 주간 목표 달성 · 행운으로만 나온다. 주당 상자가 1 → 2개가 되는 셈. 괜찮은지.
4. **주간 목표 카드에 합치기** vs 따로 카드. 합치기를 추천(숫자 늘리지 않기).
5. 2단계(모임 보스)를 언제 시작할지 — 1단계를 2~3주 써 본 뒤를 추천.

---

## 9. 일부러 안 하는 것

- 러닝 중 실시간 전투 · 페이스 기반 데미지(안전 · 공정성).
- 다른 사람 그림자 보기 · 그림자 랭킹(1단계는 혼자만의 거울. 비교는 모임 보스에서).
- 보스 종류 · 등급 · 새 픽셀 아트(재미 확인 전엔 그림 비용 X).
- 효과음 · 진동(1차 X. 러닝 구간 진동은 2차 후보).
- 데미지 레벨 배율(그림자에게는 X — 2.4 참고).
