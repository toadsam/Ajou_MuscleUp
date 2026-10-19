# 2026-10-20 · 그림자 던전 PR B + C — 화면(전체 화면 던전 · 기술 · 타이밍 · 충전 연출 · 입구)

설계: [docs/design/shadow-dungeon.md](../design/shadow-dungeon.md) 5절. 백엔드는 [2026-10-20-shadow-dungeon-backend.md](2026-10-20-shadow-dungeon-backend.md).
사용자가 "화면까지 한번에"라고 해 PR B(던전 화면)와 PR C(입구 · 충전 연출)를 PR A 와 같은 브랜치(#54)에 넣었다.

## 1. 타입 · 규칙 (`lib/shadow.ts`)

- `ShadowSource` 에 `DUNGEON` · `SETTLE`, `ShadowSkill`(LEGS · CHEST · BACK · ARMS · RUN) · `ShadowGrade`.
- `ShadowHit` 에 `skill` · `grade` · `bonus` · `shares` · `chargeLeft` · `critTokensLeft`, `ShadowStatus` 에 `charge` · `chargeTotal` · `critTokens` · `passives` · `stats`, 새 `ShadowCharge`(저장 응답 `shadowCharge`).
- `SKILL_META`: 기술 이름 · 채우는 운동 · 원판 색(국제 규격 — 통 구분) · 내 동작(`squat` · `bench` · `deadlift` · `press` · `run`) · 연출 종류(`quake` · `push` · `lift` · `jab` · `dash`) · 힌트.
- `gradeOf(position)`: 가운데 ±6% PERFECT · ±15% GOOD. `localStrike` 등 로컬 셈은 `/dev/dungeon` 전용(서버 ShadowRules 와 같은 규칙, 실제 화면은 서버 응답만 믿는다).

## 2. 던전 부품 (`components/boss/`)

| 파일 | 하는 일 |
|---|---|
| `DungeonStage.tsx` (새) | 무대 · 두 캐릭터 · HpBar 가 계속 떠 있고 strike 응답(`hit`)마다 한 기술을 연출. 타는 `hit.shares` 로 나누고 타마다 히트스톱 · 타격 자국 · 색 반전 · 조각 숫자. 끝나면 합계 쾅 + 등급 도장(PERFECT! 노랑 · GOOD 초크 · MISS 회색) + 치명타 도장. 처치면 4단계 무너짐 → 조각 10개 → DOWN. `windup` 이면 힘주는 자세, `entering` 이면 그림자가 걸어 나옴 |
| | 기술별: 지진 `dg-jump`(점프 → 착지) + `dg-launch`(그림자 떠올랐다 떨어짐) + 바닥 균열 `FloorCrack` + `dg-quake-hard` · 밀어내기 `dg-knock-far` + 벽 먼지 `dg-dust` · 들어 던지기 1타 `dg-lift-up`(떠 있음) → 2타 `dg-slam-down` · 연타 `dg-dash-jab` 300ms × 4 + 작은 숫자 · 돌진 `dg-through`(그림자를 뚫고 무대 밖 → 왼쪽에서 복귀) + 잔상 `dg-ghost` 3장 |
| `TimingGauge.tsx` (새) | 바벨 위를 원판이 0.8초 왼→오른쪽(`dg-gauge-slide`). 게이지 전체가 탭 자리. `performance.now()` 로 위치 → `gradeOf`. 안 누르면 MISS |
| `SkillPlates.tsx` (새) | 기술 원판 5개(56px, 색 = 통) + 남은 힘 숫자, 0 이면 회색(`aria-disabled`). 초크 통 토글(토큰 있을 때만) — 켜 두고 기술을 누르면 `crit: true`. `PlateIcon` 은 /shadow · 충전 연출도 씀 |
| `DungeonView.tsx` (새) | 흐름: 원판 탭 → `windup` + 게이지 → 탭 → `strike(skill, grade, crit)` → 연출 → `onDone` 으로 통 · 토큰 · 체력 갱신(서버 응답값). 전체 화면(`fixed inset-0 z-[70]`, 머리 · 탭바 위), 세로 420px 기둥. 능력치 칩 3개 · 패시브 칩, 빈 통 토스트, 전리품 카드, "다 썼어요" 안내 |
| `ImpactMark.tsx` · `fightParts.ts` (새) | 1차 BossFight 안에 있던 타격 자국 · 조각 방향 · 덩치 셈을 밖으로(BossFight 는 그대로 둠) |
| `ChargeScene.tsx` (새) | 저장 결과 맨 위: 내 캐릭터 동작 1회 → 통별 원판이 던전 문으로 날아감(`dg-fly`, 통마다 하나 + 60 마다 하나, 최대 5) → 문 앞에 쌓임 → "+65 모음" 쾅 → 통별 칩 · 치명타 토큰 · 상한 → [던전 가서 쓰기]. 1.2초 |
| `DungeonDoor.tsx` (새) | 문틀 + 빨간 눈(깜빡 `dg-door-eye`). 충전 연출 · 홈 지도 입구 목록 |
| `ShadowHomeRow.tsx` | 모은 힘이 있으면 "힘 120 모음 · 던전 →"(`/shadow/dungeon`), 없으면 1차 문구(`/shadow`) |

## 3. 화면 · 라우트

- `pages/ShadowDungeon.tsx` (`/shadow/dungeon`, ProtectedRoute): `POST /api/shadow/dungeon/enter` + 캐릭터 + mbti → `DungeonView`, strike 는 `POST /api/shadow/dungeon/strike`. 나가기 → `/shadow`.
- `pages/DevDungeon.tsx` (`/dev/dungeon`, DEV 만): 가짜 4종(보통 주 · 처치 직전 · 빈 통 · 이미 처치), strike 는 로컬 셈 + 120ms 지연.
- `pages/ShadowBoss.tsx` (`/shadow`): 맨 위에 "모은 힘" 통 5개 + 패시브 + [던전 들어가기]. 타 목록은 기술 이름 · PERFECT 칩 · 보너스, 다시 보기는 그 기술 동작. 규칙 문단에 던전 설명.
- `pages/WorkoutSession.tsx` · `Running.tsx`: 1차 `BossFight` 자리에 `ChargeScene`(`result.shadowCharge`). 타입 `lib/workoutSession.ts` · `lib/running.ts` 의 `shadow` → `shadowCharge`.
- `components/gymMap/GymMap.tsx`: 1층 입구 매트 공간 목록 맨 위에 "그림자 던전"(잠금 없음, 로그인 필요) → `/shadow/dungeon`.
- `pages/DevBoss.tsx`: 가짜 Hit 에 새 칸(null · 0 · []).
- `index.css`: "그림자 던전" 블록 — `.dg-enter` `.dg-jump` `.dg-launch` `.dg-knock-far` `.dg-lift-up` `.dg-slam-down` `.dg-dash-jab` `.dg-through` `.dg-ghost` `.dg-crack` `.dg-dust` `.dg-gauge-slide` `.dg-plate-btn` `.dg-fly` `.dg-door-eye` + 키프레임. 블러 · 글로우 없음, 새 픽셀 그림 없음.

## 4. 확인한 방법

- `bash scripts/verify.sh` 통과(tsc 0 · 린트 늘지 않음 · 빌드). main 에서 들어온 바코드 패키지(`@zxing/*`)가 worktree 에 없어 tsc 가 깨졌던 건 `npm install` 로(코드 문제 아님).
- `/dev/dungeon`(서버 없이, 5174): 보통 주 — 초크 켜고 지진 → `+108 GOOD 치명타!`(60 +5% GOOD +5% 삼대장 = 66 × 1.64), 통 150 → 90, 토큰 2 → 1, 체력 420 → 312 · 돌진 63(장거리 2타) · 들어 던지기 47 · 연타 30 · 빈 통 토스트 · 처치 직전 — 지진 2번 → DOWN · 전리품(+10 · 상자 1 · 칭호 1) · "모은 힘을 다 썼어요".
- **실제 서버**(이 브랜치 백엔드 8081, 시험 계정): 운동 · 러닝 저장 → `shadowCharge {LEGS 80, CHEST 30, BACK 24, ARMS 12}` · `{RUN 52}` 토큰 2 → `/shadow/dungeon` enter(패시브 삼대장 · 힘 353kg) → 초크 켜고 지진 → `+95 치명타!`(60 +5% = 63 × 1.51), 통 80 → 20, 토큰 1, 체력 100 → 5 → `/shadow` 통 현황 · 타 목록. 계정 · 행은 탈퇴 + SQL 로 정리.
- 미리보기 창이 숨겨진 세션(창에 열려 있지 않음)이라 **타이머가 1초 단위로 늦춰져 등급이 MISS/GOOD 으로만 나왔고, 스크린샷은 찍히지 않았다** — 숫자 · 문구 · DOM 으로 확인. 눈으로 보는 건 사용자가 `/dev/dungeon` 에서.

## 5. 아직 못 한 것

- 실제 운동 세션 흐름(시작 → 세트 → 끝내기)에서 `ChargeScene` 이 뜨는 것은 안 돌림(삽입 위치 · 타입으로만). 사용자가 세션 한 번 저장해 보면 된다.
- 홈 지도 입구 매트의 "그림자 던전" 항목은 캐릭터가 매트 위에 서야 나오는 시트라 DOM 으로 못 봤다(tsc · 린트만). 홈 한 줄 "힘 138 모음 · 던전 →" 은 실제 데이터로 확인.
- 375px 스크린샷(미리보기 창 숨김). 레이아웃은 420px 기둥 + `grid-cols-5` 라 375 에서 잘리지 않게 설계(원판 56px × 5 + 간격 = 296px).
- 개발 서버 StrictMode 에서 `enter` 가 두 번 가(`visits` 2씩) — 통계 칸뿐이라 두지 않음. 운영 빌드는 한 번.
- 처치 공유 카드(1차 PR 3) 는 미착수.
