# 2026-10-19 · 주간 보스 "그림자" PR 2 — 화면(전투 장면 · 홈 카드 · 그림자 화면 · /dev/boss)

설계: [docs/design/shadow-boss.md](../design/shadow-boss.md) 5절. 서버는 [PR 1 기록](2026-10-19-shadow-boss-backend.md).
사용자 요청: "화면까지 만들자 · 모든 디자인 스킬로 역동적으로". 짐 플로어(v2) 규칙 안에서 — 새 픽셀 아트 0장, 유리 · 블러 · 네온 없음, 동작은 ≤600ms 단위.

디자인 결정 한 줄: **보스전의 기억은 처치 순간**이다. 공격 · 치명타는 짧고 단단하게(초크 · 흔들림), 처치만 길게(무너짐 → 원판 조각 → 전리품 카드 → 알통). 그 밖은 조용히.

## 1. 전투 장면 — `components/boss/BossFight.tsx`

입력: `ShadowHit` + 내 캐릭터(`StageCharacter`) + 오늘 대표 동작(`FightMotion` = 종목 동작 · 기구 · 원판).

사용자 피드백("임팩트가 확실하게, 진짜 공격하는 느낌") 뒤 격투 게임 문법으로 다시 짰다. 제자리에서 동작 → 숫자가 뜨는 식이 아니라 **닿는다**:

| 장면 | 무엇이 보이나 | 길이 |
|---|---|---|
| 한 타(`.dg-dash`) | 내 캐릭터가 뒤로 움츠렸다(−12px) 그림자까지 돌진(`--dash` = 두 칸 사이 거리를 재서 넣음) → 닿은 채 멈칫(히트스톱 90ms) → 제자리 | 640ms(센 타 780) |
| 닿는 순간 | 타격 자국(픽셀 별, `.dg-impact` 220ms) · 그림자 색 반전 1프레임 + 넉백 14px · 기울기(`.dg-hit` 300) · 무대 흔들림(`.dg-quake` ±3px) · 체력 바 빨강 **즉시** 깎임 · 맞은 자리 위로 "+조각" 숫자(`.dg-float`) | |
| 연타 | 힘 ~39 한 번 · ~99 두 번 · 그 위 세 번. 조각은 25 · 30 · 45%(마지막이 가장 큼), 마지막 타는 센 타(`.dg-hit-hard` 2프레임 반전 · 26px 넉백 420ms) | |
| 치명타 | 마지막 타에 초크 가루 + `.dg-quake-hard`(±7px 260ms), 합계 숫자 노랑 + "치명타!" 도장(`.dg-stamp`) | |
| 합계 | 모든 타 뒤 "오늘 힘 +N" 이 2.6배 크기에서 **쾅 찍힌다**(`.dg-slam`, 잉크 그림자 3px) | 420ms |
| 처치 | 그림자 4단계 무너짐(`.dg-collapse` 480) → 원판 조각 10개(`.dg-shard` 600) + "DOWN" 도장 → 전리품 카드 `.dg-pop` + 내 캐릭터 알통 · 펌핑 | |

- 진행표는 `setTimeout` 배열 하나로(`plan(ms, fn)`): 200 시작 → 타마다 140 움츠림 · 300 접촉 · 640/780 끝 → 합계 520 → (처치) 480 · 640 → 끝. `replayKey` 가 바뀌면 처음부터, 건너뛰기는 바로 끝 상태(체력도 `hpAfter`).
- 체력 손실은 타마다 나눠 깎는다(`split(hpBefore − hpAfter, n)`, 합이 정확). 조각 숫자는 힘(`damage`)을 같은 비율로 나눈 것.
- 돌진 애니메이션 · 피격 · 타격 자국은 React `key` 를 타 번호로 바꿔 매번 처음부터 다시 돈다. 옆모습 그림자의 뒤집기는 svg 쪽이라 넉백 transform 과 안 겹친다.
- `prefers-reduced-motion` 이면 바로 끝 상태(전역에서 꺼져 있지만 안전장치).
- 상황 문구: 하루 상한에 걸린 공격(`damage 0`) · 이미 쓰러진 그림자(`hpBefore 0`, 오버킬만) · 치명타 설명 · 보상 없는 처치(다시 보기).
- 전리품 카드: 점수 +10 · 상자 1 · 새 칭호 n(`.dg-well` 세 칸) + 칭호 이름 + "상자 열기"(`/collection`) · "이번 주 전적"(`/shadow`). `noLinks` 로 그림자 화면 안에서는 버튼을 뺀다.

## 2. 그림자 스프라이트 — `components/boss/ShadowSprite.tsx` + `pixelAvatar.ts` `eyeColor`

- `buildPixelAvatar` 를 직접 불러 같은 리프터를 어두운 색으로: 피부 `#26272B` · 머리 `#1A1A1C` · 민소매 `#3A3D43`, 눈만 `#D9302A`(빨간 원판).
- `PixelAvatarSpec.eyeColor?`(기본 검정) 한 칸을 더했다 — 정면 · 옆모습(`buildSideArt`) · 기구 자세(`pixelPoses.ts`) 세 곳의 눈 픽셀이 쓴다. 다른 화면은 값을 안 주므로 그대로.
  ```diff
  -    g.set(10, 7, INK);
  -    g.set(13, 7, INK);
  +    g.set(10, 7, eye);
  +    g.set(13, 7, eye);
  ```
- 머리 모양은 내 시드를 따라가고(`resolveSeedFeatures`), 근육 단계는 `BossFight.buildOf` 가 `AvatarRenderer` 와 같은 셈으로 구한다 → "나의 그림자".
- 피격 자세 = 내 동작의 프레임 1 고정. 옆모습 동작(벤치 · 푸시업 · 기구 · 달리기)은 `svg` 에 `scaleX(-1)` 로 뒤집어 마주 본다(뒤집기를 바깥 div 에 두면 `.dg-hit` 의 transform 과 겹쳐 300ms 동안 풀린다 — svg 로 옮김).

## 3. 체력 바 — `components/boss/HpBar.tsx`

- 격투 게임 체력 바처럼 두 겹: 빨간 원판 색(`value`, transition 없음 — 맞는 순간 바로 깎임) 위에, 초크색 잔상(`.dg-hp-ghost`)이 120ms 뒤 0.5초에 걸쳐 따라 내려온다. 숫자는 0.25초 트윈(rAF). 0 이 되면 `.dg-hp-empty` 로 두 번 깜빡.
- 25 · 50 · 75% 에 바닥 테이프 같은 눈금. `role="meter"` + `aria-valuenow`. 남은 체력 25% 이하면 빨강.

## 4. CSS — `index.css` 맨 아래 "주간 보스 그림자"

`.dg-hp-ghost` `.dg-hp-empty` `.dg-dash` `.dg-dash-heavy` `.dg-hit` `.dg-hit-hard` `.dg-impact` `.dg-float` `.dg-slam` `.dg-stamp` `.dg-ink-shadow` `.dg-quake` `.dg-quake-hard` `.dg-collapse` `.dg-shard`
+ 키프레임 13개. 돌진은 `translateX(var(--dash))` 에 47~61% 구간을 같은 값으로 잡아 "닿은 채 멈칫"을 만든다. 무너짐은 `clip-path: inset(0 → 100% 0 0 0)` 을 `steps(4)` 로, 조각은 `--dx --dy --rot` 를 인라인으로 받아 날아간다.
유리 · 블러 · 네온 없음 — 잉크 그림자는 3px 딱딱한 오프셋, 피격은 `invert` 1~2프레임뿐.

## 5. 결과 화면 2곳 · 홈 · 라우트

- `pages/WorkoutSession.tsx`: 결과 맨 위(펌핑 카드 위)에 `<BossFight>`. 동작은 첫 종목(`motionFor(exerciseInfo(code))`), 바벨이면 가장 무거운 세트의 원판(`barbellLoad`).
- `pages/Running.tsx`: 결과 맨 위, 동작 `run`.
- `lib/workoutSession.ts` · `lib/running.ts`: 저장 응답 타입에 `shadow: ShadowHit | null`.
- `pages/Home.tsx` + `components/boss/ShadowHomeRow.tsx`: 주간 목표 화이트보드 카드의 `action-stats` 아래 한 줄 "그림자 ████░░ 228 남음 →"(마커 빨강 · 보드 잉크 · 펜 글씨). 휴식 주 "쉬는 중", 처치 "처치! 오버킬 n%", 연속 "n주 연속". 새 카드를 늘리지 않았다(설계 5.3). `GET /api/shadow` 는 실패해도 홈이 뜬다.
- `App.tsx`: `/shadow`(ProtectedRoute) · `/dev/boss`(DEV 만).

## 6. 그림자 화면 — `pages/ShadowBoss.tsx` (`/shadow`)

- 위: 마지막 공격 다시 보기(`BossFight` + `replayKey`, "다시 보기"). 공격이 없으면 마주 선 둘 + 꽉 찬 체력 바 + "운동 시작 · 러닝 시작". 휴식 주면 "이번 주는 쉬어요".
- 가운데: 이번 주 공격 목록(날짜 · 출처 · 상한/치명타 설명 · 치명타 · 처치 칩 · +힘).
- 아래: 최근 8주 원판 줄 — 빨간 원판 처치 · 쇠 원판 놓침 · 점선 휴식 · 흐린 점선 기록 없음, 이번 주는 노란 테. 지난주 한 줄. 규칙 한 문단(개발자 문구 없음).
- 다시 볼 때의 대표 동작: 세션은 종목을 모르니 스쿼트, 러닝은 달리기.

## 7. 개발 확인 — `pages/DevBoss.tsx` (`/dev/boss`, 로그인 없음)

가짜 공격 6종(보통 · 치명타 러닝 · 처치 · 치명타+처치 · 하루 상한 · 이미 쓰러짐) + 가짜 캐릭터. 칸마다 "다시".

## 8. 서버 응답에 두 칸(PR 1 보강) — `dto/shadow/ShadowHitResponse`

`hp`(이번 주 체력 — 바의 전체 길이) · `hitOn`(공격한 날 — 목록의 요일). `ShadowBossService` 의 두 생성자 호출만 바뀜. `ShadowBossServiceTest` 12개 그대로 통과.

## 9. 확인

- `tsc` 0 오류, `verify.sh` 통과(바뀐 TS 파일의 린트 문제 수가 늘지 않음 · 빌드 통과).
- `/dev/boss` 6종: 데스크톱(1100px) · 375px 스크린샷 `docs/screenshots/2026-10-19-shadow-dev-boss-*.jpg`. 처치 장면은 "다시"를 누르고 0.6초 간격으로 찍어 피격 반전 → 숫자 → 조각 → 전리품 순서를 확인했다.
- 돌진 · 연타로 바꾼 뒤(세션 뒤쪽): 앱 창이 화면에 없어 미리보기 브라우저가 그림을 새로 그리지 않았다(배경 탭 — 타이머 · 스크린샷 모두 멈춤). 그래서 `setTimeout` 을 가로채 진행표를 손으로 1,780ms(셋째 타 접촉)까지 돌리고 Web Animations API 로 멈춘 뒤 계산된 스타일을 읽었다: 내 캐릭터 `translateX(226px)`(그림자 칸까지), 그림자 `invert(1)` + 14px · 6° 넉백, 타격 자국 scale 1 · 회전 10°, 조각 숫자 "+103" 떠오르는 중, 무대 −6.6px/3.8px 흔들림, 체력 바 빨강 0% · 잔상 90%. 이어서 끝 상태: 전리품 카드 · "DOWN" · 조각 10개. **눈으로 본 것은 아니다** — 사용자가 `/dev/boss` 에서 직접 보고 세기를 정하면 된다(상수는 `BossFight.tsx` 위쪽과 CSS 키프레임).
- 로그인 화면(시험용 로컬 계정, API 로 가입 · 로그인 뒤 저장소에 토큰): 홈 카드 줄("100 남음" → 처치 뒤 "처치! 오버킬 36%"), `/shadow` 빈 상태 · 공격 2번(치명타 · 처치) 다시 보기 · 8주 전적 · 375px — `docs/screenshots/2026-10-19-shadow-page-*.jpg` `…-home-row.jpg`. 시험 계정과 행은 SQL 로 지웠다.
- 운동 · 러닝 **결과 화면 자체**는 화면 흐름(세션 시작 → 세트 → 끝내기)을 로그인 계정으로 돌리지 않아 `/dev/boss` 와 코드 삽입 위치로만 확인했다 — 사용자가 실제 세션 한 번 저장해 보면 된다.

## 10. 남은 것

- PR 3: 처치 공유 카드(`lib/bossShareCard.ts`, 캔버스 직접 그림) — 전리품 카드에 "공유" 버튼을 붙일 자리는 있다.
- 2차: 홈 지도에 그림자 NPC, 일요일 푸시, 꾸미기 `SHADOW_KILLS`.
