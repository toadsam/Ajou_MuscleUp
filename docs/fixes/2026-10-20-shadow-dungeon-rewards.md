# 2026-10-20 · 그림자 던전 지도판 D3 — 꾸미기 보상(헬스장 물품 · 그림자 테두리 · 몬스터 도감 · 처치 공유 카드)

설계: [docs/design/shadow-dungeon-map.md](../design/shadow-dungeon-map.md) 5절. 원칙: **보상은 꾸미기 · 자랑만, 힘은 안 준다.** PR #54 위에 더했다.

## 1. 홈 헬스장 꾸미기 (`GymDecorItem` · `GymDecorService` · `gymMap/decor.ts`)

| 코드 | 이름 | 얻는 조건(새 목표) | 자리 |
|---|---|---|---|
| `SHADOW_TROPHY` | 그림자 트로피 | `SHADOW_KILLS` 5 — 주간 보스 그림자 5번 처치 | 벽(1층 · 2층) · 카운터 |
| `DUNGEON_DOOR` | 던전 문 장식 | `SHADOW_KILLS` 10 | 벽 |
| `SLIME_PLUSH` | 야식 슬라임 인형 | `MOB_KILLS` 30 — 던전 몬스터 30마리 | 구석(1층 · 2층 · 식당) |
| `UNIFORM_SHADOW` | 그림자 조끼(LOOK, 직원 유니폼) | `SHADOW_KILLS` 20 | 유니폼 |

- 목표 계산: `SHADOW_KILLS` = `shadow_weeks.killed_at` 있는 주 수, `MOB_KILLS` = `shadow_mobs.killed_at` 있는 수. 얻었는지는 기록에서 계산(저장 안 함 — 꾸미기 규칙 그대로).
- 그림(`decor.ts`): `shadowTrophy`(먹색 컵 + 빨간 눈) · `dungeonDoor`(볼트 문틀 · 어둠 · 빨간 눈 · 노랑/검정 띠) · `slimePlush`(주황 슬라임), `UNIFORM_COLOR.UNIFORM_SHADOW` #26272B. 새 그림은 사각형만.
- 직원 꾸미기 창 유니폼: 지금까지 유니폼은 전부 처음부터 있어서 잠금 표시가 없었다 → 못 얻은 건 `disabled` + 진행도(`5/20`) + 툴팁 힌트.
- `GymDecorTest` 전체 물품 수 33 → 36(DECOR 3개, 조끼는 LOOK 이라 안 셈).

## 2. 도감 (`CollectionItem` · `CollectionService` · `pages/Collection.tsx`)

- **그림자 사냥 테두리** `F_SHADOW`(FRAME, EPIC, 값 `shadow`, 업적 `SHADOW_STREAK_8` = 그림자 8주 연속). CSS `.dg-frame-shadow`(잉크 · 먹색 · 빨간 줄).
- **몬스터 도감** 새 칸 `MONSTER`: `M_TOMORROW` · `M_MIDNIGHT_SNACK` · `M_SNOOZE`(보통) · `M_EXCUSE`(희귀) · `M_SOFA`(영웅), 업적 `MOB_*`(그 종류를 한 번이라도 잡았나). 상자에서 안 나옴(업적 아이템).
  - 잡몹을 잡으면 그 자리에서 `unlockAchievements`(카드 등록). `equip(MONSTER, …)` 은 400 "몬스터 카드는 도감에서 보기만 해요."
  - 화면: 탭 "몬스터 n/5", 그림은 `MobSprite`(지도 · 전투 창과 같은 그림), 잡은 카드는 장착 버튼 대신 "던전에서 잡았어요".
- 전투 창의 "도감 카드 첫 등록" 칩이 `/collection` 링크.

## 3. 처치 공유 카드 (`components/boss/ShadowShareEditor.tsx`)

- 러닝 · 출석과 같은 `PhotoShareEditor`(캔버스 직접 그림 · 미리 만든 파일로 Web Share · 사진 깔기 · 워터마크 하나).
- 내용: 윗줄 "2026.10.19 – 10.25 · 그림자 던전", 한마디 "지난 4주의 나를 넘었다", 큰 글자 "DOWN / 주간 보스 그림자 처치", 숫자(켜고 끄기) 그림자 체력 · 오버킬 · 연속 처치 · 잡몹 처치 · 날짜.
- 여는 곳: 던전 전투 창의 보스 처치 카드 [공유 카드], `/shadow` 맨 위 [처치 공유 카드 만들기](이번 주 처치했을 때).

## 4. 확인

- `ShadowBossServiceTest` 새 3개(잡몹 → 몬스터 카드 · 장착 거부 · 상자에 없음 / 8주 연속 → 그림자 테두리 · 장착 / 처치 수 → 트로피 열림 · 문 5/10 · 인형 진행도 · 벽에 놓기 · 못 얻은 조끼 거부). 백엔드 전체 **116개 통과**(local). `verify.sh` 통과.
- 8081 실제 호출(시험 계정, 지난 5주 처치 행을 넣음): 잡몹 처치 → `/api/collection` 몬스터 칸 `M_MIDNIGHT_SNACK` 만 owned, `F_SHADOW` 5/8, MONSTER 장착 400 · 한국어 문구, `/api/gym-decor` 트로피 열림 5/5 · 문 5/10 · 인형 1/30 · 조끼 5/20, 벽에 트로피 놓기 200. 계정 · 행 정리.
- 브라우저 `/collection`(5174 → 8081): 탭 "몬스터 1/5", 카드 5장 그림(SVG 5개) · 잡은 카드 문구, 테두리 칸 "그림자 사냥 테두리 5/8", `.dg-frame-shadow` box-shadow 적용, 375px 탭 넘침 없음.
- `/dev/dungeon` 첫 주: 보스까지 가서 지진 2번 → 처치 카드 → [공유 카드] → 편집기 열림 · 캔버스 1080×1920 에 글자 픽셀 그려짐.

## 5. 아직 못 한 것

- 눈으로 본 확인(미리보기 창 숨김 — 새 꾸미기 물품 그림 · 도감 몬스터 카드 · 공유 카드 모양). 홈 지도에 트로피 · 문 · 인형을 놓은 모습, 그림자 조끼 입은 직원은 숫자로만.
- 실제 휴대폰 Web Share(파일 공유) 미확인 — 러닝 · 출석과 같은 부품이라 같은 동작으로 본다.
