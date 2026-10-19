# 2026-10-20 · 그림자 던전 PR A — 백엔드(힘 모으기 · 기술 · 타이밍 · 패시브 · 정산)

설계: [docs/design/shadow-dungeon.md](../design/shadow-dungeon.md). 1차(#52)의 "저장 = 즉시 공격"을 "저장 = 힘 모으기, 던전에서 기술로 쏘기"로 바꿨다.
결정(사용자, 8절 추천값): 즉시 공격 없앰 · 한 번 누름 60 · 타이밍 +10/+5% · 패시브 합 15% · 삼대장 300kg(여 200) · 정산 월요일 00:05 · 던전 횟수 제한 없음.

## 1. 데이터 (`entity/`)

| 파일 | 바뀐 것 |
|---|---|
| `ShadowCharge.java` (새) | 표 `shadow_charges` — 저장 한 번 = 통(skill)별 한 줄. `source` · `source_id`(세션 · 러닝 id) · `skill` · `hit_on` · `raw`(상한 전) · `gained`(통에 들어간 힘) · `crit_token`. 인덱스 (source, source_id) · week_id |
| `ShadowWeek.java` | 칸 추가 `charge_legs` `charge_chest` `charge_back` `charge_arms` `charge_run` `crit_tokens` `visits`(전부 `@ColumnDefault("0")`), `settled`(`@ColumnDefault("true")` — 1차 행은 이미 공격이 들어간 주라 true, 새 주는 false). 도우미 `charge(skill)` · `addCharge(skill, delta)`(0 아래 X) · `chargeTotal()` |
| `ShadowHit.java` | 칸 추가 `skill` `grade`(nullable) · `bonus`(default 0). 상수 `DUNGEON` · `SETTLE`(source). 1차 SESSION · RUN 행은 그대로 |

- 설계 3절의 `force` 칸은 **`gained`** 로 — `force` 는 MySQL 예약어라 `create table` 이 실패했다(테스트에서 `Table 'shadow_charges' doesn't exist` 로 드러남).
- 기본값은 `org.hibernate.annotations.ColumnDefault` 로 DDL 에 넣었다(이 저장소에서 처음 씀). 로컬 MySQL 에서 `charge_legs 0 · settled b'1' · bonus 0` 으로 만들어지는 것을 확인. **Postgres 는 미확인**(아래).

## 2. 규칙 (`service/ShadowRules.java`, 순수 함수 · 상수)

```
SKILLS = [LEGS, CHEST, BACK, ARMS, RUN]      SKILL_LABEL 지진 · 밀어내기 · 들어 던지기 · 연타 · 돌진
STRIKE_CHUNK 60   TIMING_PERFECT_PCT 10   TIMING_GOOD_PCT 5
PASSIVE_PCT 5   PASSIVE_CAP_PCT 15   BIG_THREE_KG 300 / 200(여)   LONG_RUN_M 10,000   STEADY_DAYS 3   HUNTER_CRIT_BONUS 0.1
skillOf(category)  LEGS · CHEST · BACK 그대로, 나머지(SHOULDERS · ARMS · CORE · OTHER · 모름) → ARMS
chunk(pool) = min(pool, 60)        timingPct(grade)        passivePct(skill, passives) ≤ 15
boosted(force, pct) = round(force × (100+pct)/100)        strikeDamage(force, pct, crit, mult) = crit ? round(boosted × mult) : boosted
critMultiplier(level, hunter) = 1.5 + 레벨×0.01 (+0.1)
shares(skill, damage, passives)  연출용 타 분배: BACK [30%, 70%] · ARMS 4등분 · RUN 장거리면 2등분 · 나머지 1타
```

## 3. 서비스 (`service/ShadowBossService.java`, 다시 씀)

| 메서드 | 하는 일 |
|---|---|
| `status` · `history` | 먼저 `settleOld`(지난 주 미정산 정산) → 이번 주 행 → 응답에 `charge` · `chargeTotal` · `critTokens` · `passives` · `stats` 추가 |
| `onSession(user, session, hasPr)` → `ShadowChargeResponse` | 세트마다 무게×횟수(맨몸은 횟수×20kg)를 종목 `category` 의 통으로 나눠 `sessionForce`. 합이 1 미만이면 null |
| `onRun` | 거리 ÷ 100 → RUN 통 |
| `charge(...)` (private) | 하루 상한 300 은 `shadow_charges.raw` 의 그 날 합으로. 큰 통부터 채우고 남은 것은 `gained 0` 줄로 남김(상한 계산용). PR 이면 `crit_tokens + 1`, 가장 큰 통 줄에 `crit_token` |
| `enter` | `visits + 1` → `status` |
| `strike(user, skill, grade, useCrit)` | 통 비면 400 "이번 주 {하체} 운동으로 모은 힘이 없어요…", 모르는 기술 400. `chunk` 만큼 빼고 보너스(타이밍 + 패시브) → 치명타(토큰 있고 켰을 때만, 토큰 −1) → `apply` |
| `apply(...)` (private) | 1차 `attack` 의 합계 · 처치 · 보상 부분. `shadow_hits` 에 `skill` · `grade` · `bonus`. 응답에 `shares` · `chargeLeft` · `critTokensLeft` |
| `settle(week)` | 큰 통부터 통째로 기본 공격(보너스 0, 토큰은 큰 통부터 하나씩), 날은 그 주 일요일, source `SETTLE`. `settled = true` |
| `unsettledWeekIds` · `settleWeek(id)` | 스케줄러용(한 주씩 따로 트랜잭션) |
| `onDeleted(source, id)` | 충전 줄을 지우며 통에서 `min(통, gained)` 을 빼고, 모자란 만큼(이미 쓴 힘)은 **마지막 타부터 피해를 깎는다**(`reduceSpent`). 안 쓴 토큰도 뺌. 1차 공격 행(SESSION · RUN)도 같이 지움. 그 뒤 `recount`(처치 · 보상 유지) |
| `passives(user, week, ws)` | 삼대장(`LiftService.bests` 3대 e1rm 합, 성별은 `CharacterProfile.gender`) · 장거리(이번 주 `RunSession` 거리) · 꾸준함(`countByUserAndDidWorkoutTrueAndDateBetween`) · 사냥꾼(`T_SHADOW_STREAK_4` 보유). 저장 안 함 |
| `stats(...)` | 힘 = 3대 e1rm 합(kg), 지구력 = 최근 4주 러닝 km(소수 1자리), 출석 연속일(오늘 안 했으면 어제부터), 주간 목표 연속(`WeeklyGoalService.status`), 레벨 = `levelAtStart` |

- 새 의존: `ShadowChargeRepository` · `RunSessionRepository` · `AttendanceLogRepository` · `UserCollectionItemRepository` · `LiftService` · `WeeklyGoalService`. 순환 없음(둘 다 저장 서비스에 의존하지 않는다).

## 4. API · DTO · 저장 응답

- `controller/ShadowController.java`: `POST /api/shadow/dungeon/enter`, `POST /api/shadow/dungeon/strike` `{skill, grade, crit}`(`dto/shadow/ShadowStrikeRequest`).
- `ShadowHitResponse`: 뒤에 `skill` · `grade` · `bonus` · `shares` · `chargeLeft` · `critTokensLeft`(목록에서는 null).
- `ShadowStatusResponse`: 뒤에 `charge`(LEGS · CHEST · BACK · ARMS · RUN 순, 0 포함) · `chargeTotal` · `critTokens` · `passives` · `stats{strengthKg, enduranceKm, attendanceStreak, weeklyStreak, level}`.
- `ShadowChargeResponse`(새): `charged`(0 인 통 없음) · `total` · `critToken` · `capped` · `chargeLeft` · `chargeTotal` · `critTokens` · `hp` · `remaining` · `killed`.
- `WorkoutSessionService.SaveResult` · `RunService.SaveResult`: `shadow`(Hit) → **`shadowCharge`**(ShadowChargeResponse). 1차 화면은 `result.shadow` 가 없어져 전투 장면만 안 뜬다(설계 6절, PR C 에서 충전 연출로).
- `scheduler/ShadowScheduler.java`(새): `0 5 0 * * MON` Asia/Seoul → `unsettledWeekIds` 하나씩 `settleWeek`, 실패는 warn.
- `AccountDeletionService`: `ShadowCharge` 삭제(ShadowHit 앞). `AccountSafetyTest` 에 행 하나 + 0 확인.

## 5. 테스트 (`ShadowBossServiceTest`, 19개 · 고정 Clock 2026-10-15)

빈 주(통 0 · 능력치 0 · settled false) · 체력 평균 · 통 분배(하체 · 등 맨몸 · 가슴 + 어깨 섞임) · 러닝 통 · 1 미만 · 하루 상한(큰 통 먼저, capped) ·
strike 60 묶음 + PERFECT/GOOD + 빈 통 400 + 모르는 기술 · 토큰(세션마다 1, 고른 타에 ×1.7, 타이밍 뒤 배율) · 패시브(꾸준함 · 장거리 2타, 통별 적용) ·
출석 연속일 · 삼대장 + 삭제 재계산(API) · 처치 보상 1회 · 4주 연속 칭호 + 사냥꾼 패시브 · 삭제(안 쓴 힘 → 마지막 타 깎기 → 토큰) · 1차 공격 행 삭제 ·
휴식 주 · 정산(상태 볼 때, 토큰은 큰 통, 일요일 날짜, 두 번 X) · 스케줄러(지난 주만) · API(enter · strike · runs · history · 401 · 이메일 없음).
백엔드 전체 101개 통과(`SPRING_PROFILES_ACTIVE=local`, 로컬 MySQL).

## 6. 로컬 서버 실제 호출 (8081, 시험 계정 → 탈퇴 · 행 삭제)

운동 저장(스쿼트 · 벤치 · 데드) → `shadowCharge {LEGS 10, CHEST 6, BACK 12, critToken true}` · 러닝 5.2km → `{RUN 52}` 토큰 2 ·
enter → 통 80 · 패시브 [삼대장] · 힘 327kg · strike BACK PERFECT 치명타 → 12 → 보너스 2 → 21, 분배 [6, 15], 토큰 1 ·
strike RUN GOOD → 55 · 빈 통 400 한국어 문구 · 모르는 기술 400 · 세션 삭제 → 통 0 · 토큰 0 · 마지막 타 55 → 43 · 토큰 없이 401 · 응답에 이메일 없음 · 탈퇴 뒤 행 0.

## 7. 아직 못 한 것

- **Postgres 17 미확인**: `@ColumnDefault` 가 `alter table add column … default …` 로 나가는지(MySQL 은 확인). 운영 `shadow_weeks` 에 이미 행이 있으면 default 없이 NOT NULL 칸 추가가 실패하므로, 배포 전에 Railway 스냅샷 + 첫 기동 로그를 본다. 안 되면 `db/migration/postgresql` 에 `alter table … add column … default` SQL 을 새 번호로.
- 타이밍 등급은 클라이언트 말을 믿는다(상한 10%). 기록에 남겨 두었고 더 막지 않는다(설계 2.4).
- 화면(PR B) · 입구 · 충전 연출(PR C)은 다음 PR. 그동안 저장 결과 화면의 1차 전투 장면은 안 뜬다.
