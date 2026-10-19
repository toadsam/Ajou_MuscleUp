# 2026-10-20 · 그림자 던전 지도판 D2 — 걸어 다니는 던전 · 조이스틱 · 잡몹 그림 · 전투 창

설계: [docs/design/shadow-dungeon-map.md](../design/shadow-dungeon-map.md) 2 · 3 · 4절. 백엔드는 D1([2026-10-20-shadow-dungeon-mobs.md](2026-10-20-shadow-dungeon-mobs.md)).
PR #54 위에 더했다. 2차 전체 화면판(`components/boss/DungeonView.tsx`, 이 PR 에서만 있던 파일)은 지웠다.

## 1. 새 파일 (`components/dungeon/`)

| 파일 | 하는 일 |
|---|---|
| `dungeonWorld.ts` | 캔버스 엔진. 20×36칸(16px), 화면 가로 13칸 · 카메라가 나를 따라감(광장 `plaza.ts` 방식). 방: 입구 → 방 A → 가운데 방(기둥) → 보스 방(메이플 무대 + 빨간 원). 배경은 한 번 그려 둔다(볼트 철판 벽 · 어두운 고무 매트 · 초크 점 · 원판 랙 · 벤치 · 노랑/검정 출구 매트). |
| | 이동: 조이스틱 · 방향키 · WASD 는 누르는 동안 84px/초(발 상자 ±4px 로 벽 충돌, x · y 따로 미끄러짐), 바닥 탭 = BFS 길찾기, 몬스터 · 보스 탭 = 그 앞까지. 잡몹은 자리(slot 0~4)마다 정한 두 점을 20px/초로 왕복, 쫓아오지 않음. |
| | 닿음: 13px(보스 16px) 안이면 `onEncounter` 한 번, 30px 멀어지면 다시 가능. 전투 중 `setPaused(true)` 면 멈춤(입력 · 길 지움), 끝나면 `stepBack`(상대 반대쪽으로 한 걸음). 출구 매트 위면 `onExitZone`. 이름표 · 작은 체력 바 · 쓰러진 잡몹은 회색 + "처치", 보스는 빨간 이름표 · 쓰러지면 앉은 회색 + "DOWN". DEV 에서만 `window.__dungeon`(debug · teleport). |
| `mobArt.ts` · `MobSprite.tsx` | 잡몹 5종 픽셀 그림(글자 격자 + 팔레트, 12~14×10~14). 지도는 `drawMob`(캔버스), 전투 창은 `MobSprite`(SVG). 새 그림은 이것뿐. |
| `Joystick.tsx` | 112px 고무 원 + 48px 빨간 원판 손잡이. 포인터 캡처, 반지름 밖은 자름, 손 떼면 (0, 0). |
| `DungeonMap.tsx` | 전체 화면(`fixed inset-0 z-[70]`, 가운데 480px 기둥). 위 HUD: ← · 보스 이름 · 체력 바 · 남은 잡몹 · Lv · 통 원판 5개(누르면 통별 · 토큰 · 능력치 · 패시브). 아래: 조이스틱 · 안내 · 출구 창. 닿으면 아래에서 **전투 창**: `DungeonStage`(상대 = 잡몹 그림 또는 그림자, 체력 바 이름 = 상대 이름) + `TimingGauge` + `SkillPlates` + 물러나기/지도로. 결과: 잡몹 "처치! · 조각 +n · 도감 카드 첫 등록 · 남은 힘 n 돌려받음", 보스 처치 카드. 숫자는 strike 응답만 믿는다. |

## 2. 바뀐 파일

- `components/boss/DungeonStage.tsx`: `foe`(boss | mob code) · `hpLabel` prop. 잡몹이면 `MobSprite` 에 같은 피격 · 무너짐 CSS.
- `pages/ShadowDungeon.tsx`: `DungeonMap` 으로, strike 몸에 `target`(문자열 "BOSS" 또는 잡몹 id). `/api/character/me` 의 `tank` 를 지도 캐릭터 색에.
- `pages/DevDungeon.tsx`: 지도판 가짜 4종(보통 주 + 희귀 · 첫 주 · 빈 통 · 보스 처치 뒤 잡몹 2), 잡몹 목록 만들기.
- `lib/shadow.ts`: `localStrike(..., target)` — 잡몹이면 필요한 힘만 쓰고 반환 · 조각 · 첫 처치(서버 `neededForce` 와 같은 셈).
- `pages/ShadowBoss.tsx`: 규칙 문단에 지도 · 잡몹 설명.

## 3. 확인한 방법

- `bash scripts/verify.sh` 통과(tsc 0 · 린트 늘지 않음 · 빌드).
- 이 세션의 미리보기 창이 숨겨져 **requestAnimationFrame 이 아예 돌지 않았다**(1초에 0번 측정). 그래서 rAF 를 손으로 돌리는 심(`__pump`)을 깔고 엔진을 움직여 숫자로 확인했다 — 화면 그림 · 애니메이션은 눈으로 못 봤다.
  - `/dev/dungeon` 보통 주: 방향키 위 1초 = 83px(84px/초), 왼쪽으로 걷다 희귀 소파 괴물(84)에 닿아 멈춤 · 전투 창 → 지진 MISS 63 → 다시 21 쓰고 처치 · 조각 5 · 첫 등록 · 40 반환 → "지도로" → 한 걸음 물러나 재개, 잡몹 4마리 남음. 보스 앞으로 걸어가 전투 → 돌진 63(장거리 5%) · 상단 체력 357/420. 물러나기 → 18px 뒤로. 바닥 탭 → 길찾기로 (104, 380). 조이스틱 오른쪽 0.5초 = 43px, 떼면 멈춤.
  - **실제 서버**(이 브랜치 8081 + 시험 계정): `/shadow/dungeon` → enter → 잡몹 4마리(첫 주 15) → 걸어서 알람 스누즈에 닿음 → strike(target) → 15 피해 · 처치 · 조각 1 · 첫 등록 · 46 반환, 남은 잡몹 3. 계정 · 행 정리.
  - 375×812: 가로 넘침 없음, 캔버스 375×812, 조이스틱 (16, 684) 112px, 기술 원판 줄 351px, 전투 창 높이 556px(넘치면 창 안 스크롤).

## 4. 아직 못 한 것

- **눈으로 본 확인 · 스크린샷 없음**(미리보기 창 숨김) — 사용자가 `localhost:5174/dev/dungeon` 에서 데스크톱 · 휴대폰 폭으로 봐야 한다. 조이스틱 손맛 · 이름표 크기 · 카메라 위치는 숫자로만 봤다.
- 실제 휴대폰 터치(포인터 캡처 · 멀티터치 중 다른 손가락) 미확인.
- D3 보상(누적 처치 꾸미기 · 테두리 · 도감 몬스터 카드 화면), 처치 공유 카드.
