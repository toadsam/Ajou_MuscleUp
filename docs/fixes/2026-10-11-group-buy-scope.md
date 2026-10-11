# 2026-10-11 · 0단계 PR 4 — 공동구매 "우리 모임 / 전체 모집" · 짐 안 랭킹

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §2 · §2-1. 사용자 요청: "공동구매도 같은 모임 + 전체적으로도 구할 수 있도록".
범위 조정: 소식 · 이벤트 · 프로그램 신청 · 자랑방을 짐별로 나누는 일은 짐 고르기 화면(PR 6)과 같이 해야 실제로 쓰이므로 그쪽으로 옮겼다.

## 1. 공동구매 모집 범위 (백엔드)

- 새 `entity/GroupBuyVisibility.java`: `GYM`(그 짐 멤버만) · `PUBLIC`(모든 사용자).
- `entity/Protein.java` 새 칸: `gym`(어느 짐에서 열었나, FK `gym_id`) · `visibility` · `region` · `maxParticipants`, `visibilityOrDefault()`.
- 새 `service/GroupBuyAccess.java` — 규칙 한 곳:
  - 보기: PUBLIC · 짐 없는 글은 로그인한 누구나, GYM 은 그 짐 멤버 · 작성자 · 앱 운영자. 못 보면 **404**(존재를 숨김).
  - 열기: 짐에서 열면 그 짐 멤버 + 짐 운영 중 + 공동구매 기능 켜짐. **전체 모집은 가입 7일 · 운동 3일 이상**(`app.group-buy.public-min-member-days` · `public-min-workout-days`, 앱 운영자 예외).
- `repository/ProteinRepository.java` 목록 쿼리 3개: `searchVisible`(전부: 전체 모집 + 짐 없는 글 + 내 짐들 글) · `searchPublic` · `searchInGyms`.
  ```diff
  - String NAME_FILTER = " and (:q is null or lower(p.name) like ...)";
  + String NAME_FILTER = " and lower(p.name) like lower(concat('%', :q, '%'))";  // 검색어 없으면 ""
  ```
  Postgres 에서 `:q is null` 의 null 매개변수가 bytea 로 잡혀 `lower(bytea)` 오류가 났다(MySQL 은 통과) → 빈 문자열로 넘긴다.
- `service/ProteinServiceImpl.java`
  - `create`: `gymSlug` → 그 짐, 없고 전체 모집이 아니면 기본 짐(`app.default-gym-slug`=ajou-muscleup, 멤버일 때만). 모집 범위 기본값 = 짐이 있으면 GYM, 없으면 PUBLIC. `GroupBuyAccess.requireCanOpen`.
  - `list(viewer, scope, gymSlug, q)`: `scope=all|gym|public`, `gym=슬러그`(멤버가 아니면 403).
  - `ownerTrust`: 상세용 [가입 후 지난 날, 누적 운동 일수].
- `controller/ProteinController.java`: 목록 `scope` · `gym` 매개변수, 상세는 `requireView` 후 `ownerMemberDays` · `ownerWorkoutDays`.
- `service/ProteinShareServiceImpl.java`: 신청 전 `requireView`(못 보면 404), **최대 인원**이 차면 신청 · 승인 거절(400 "모집 인원이 다 찼어요").
- `dto/protein/*`: 요청에 `gymSlug` · `visibility` · `region` · `maxParticipants`, 응답에 `gymSlug` · `gymName` · `visibility` · `region` · `maxParticipants` · 신뢰 표시 2개.
- 데이터 이전 `db/migration/common/V3__group_buy_visibility.sql`: 예전 공동구매 → 아주대 짐의 GYM(지금처럼 동아리 안에서만 보임).

## 2. 짐 안 랭킹 (백엔드)

- `GET /api/rankings/characters?gym=슬러그` — 그 짐 멤버 중 공개 캐릭터만으로 순위(레벨 · 3대). 멤버만(아니면 403), 없는 짐 404.
  순서 규칙은 전체 순위와 같다(값 → 최근 갱신). 짐 멤버를 모아 메모리에서 정렬(수백 명 이내 전제).
- `RankingService` 오버로드, `UserBodyStatsRepository.findAllByUserIn`.

## 확인 (백엔드)

- 새 `GroupBuyScopeTest` 3개: 우리 모임 글 — 바깥 사람 상세 · 신청 404, 목록에 없음, 멤버 "우리 모임" 탭에만, 남의 모임으로 거르기 · 열기 403 /
  전체 모집 — 갓 가입 403, 가입 30일 · 운동 3일 OK, 바깥 사람 보기 · 신청 OK, 신뢰 표시, 이메일 없음 / 짐 랭킹 — 바깥 403, 멤버 200, 없는 짐 404.
- 백엔드 테스트 20개 — **로컬 MySQL 과 임시 Postgres 둘 다 통과**(Postgres 에서 처음엔 2개 실패 → 위 검색어 null 문제 수정).
- 임시 Postgres 에 예전 공동구매 1개를 넣고 V3 → `GYM · ajou-muscleup`.

## 3. 화면 (프론트)

- `pages/Protein.tsx`(목록): 탭 "전체 · 우리 모임 · 전체 모집"(`scope`), 마지막 탭 기억(localStorage, try/catch), 늦게 온 이전 응답 무시.
  카드에 범위 칩(파랑 "우리 모임 · 모임 이름" / 노랑 "전체 모집") · 지역. 탭마다 빈 화면 다음 행동.
- `pages/WriteProtein.tsx`(작성): `GET /api/gyms/mine` 의 운영 중 모임 → "모집 범위"(우리 모임만 + 모임 고르기 / 전체 모집 + 조건 안내).
  모임이 없으면 전체 모집만. 최대 인원(2~500) 칸, 입력칸 16px. 실패(전체 모집 자격 미달 403 포함)는 `friendlyError` 로.
  "우리 모임만" 이면 지역 · 헬스장 칸이 비어도 되고(분류의 헬스장 자리에 모임 이름), "지역 또는 헬스장 필수" 경고는 제품명을 적은 뒤에만.
- `pages/ProteinDetail.tsx`(상세): 범위 칩 · 지역 · 최대 인원. 전체 모집이면 "여는 사람 기록"(가입 N일 · 운동 N일) + "앱은 결제를 중개하지 않아요" 안내.
  404 → "볼 수 없는 공동구매예요. 그 모임 멤버만 볼 수 있어요."
- `pages/Rankings.tsx`: "전체" + 내 모임별 버튼(`gym=슬러그`), 모임 범위에선 "이 모임 공개 캐릭터 N명". 모임이 없으면 전체만.
- 전체 모집 글은 모임을 붙이지 않는다(`gymSlug` 안 보냄) — 연 모임 이름을 보여 주려면 나중에 바꾼다.

## 확인 (프론트)

- `scripts/verify.sh` 통과: `tsc -b --force` 0, 네 파일 린트 0 → 0, 빌드 OK. 줄바꿈(CRLF) · BOM 유지.

## 못 한 것

- 화면 확인: 공동구매 · 랭킹은 로그인 + 모임 가입이 있어야 보여서 브라우저로 보지 못했다(배포 후 로그인해서 확인 필요).
- 운영 배포 시 V3 가 예전 공동구매를 아주대 짐 "우리 모임만" 으로 바꾼다(지금 보이는 사람 = 아주대 짐 멤버 = 지금 가입자 전원이라 체감 변화 없음).

## 운영 배포 결과 (2026-10-11, #10 merge 후 · 사용자 Chrome 로그인 세션으로 읽기만)

- 서버: 공동구매 목록 3범위 · 짐 랭킹(`gym=ajou-muscleup`) · 내 짐 모두 200. 운영 공동구매 글은 0개라 V3 로 바뀐 글은 없음.
- **첫 접속은 예전 화면**: 같은 탭이 예전 묶음(`index-BWppK04T.js`)을 계속 보여 줬고 "서버에 연결하지 못했어요" 가 떴다. 서비스 워커가 새 파일을 받은 뒤 **세 번째 접속**에서 새 화면(`index-D2PRLEcG.js`).
  → 로드맵 2장 "PWA 새 버전 안내 · preloadError 자동 새로고침" 을 앞당겨야 함.
- 새 화면: 목록 탭 "전체 · 우리 모임 · 전체 모집", 작성 폼 "어느 모임에서 여나요?"(내 모임 2개) · 최대 인원 · 지역, 랭킹 "전체 · 모임별" 버튼 확인.
- 다듬을 것: 작성 폼의 기본 모임이 동아리(아주대 짐)가 아니라 먼저 만들어진 운동 모임으로 잡힘. 앱 전체 공개 캐릭터가 1명뿐이라 랭킹이 빔(로드맵 3장 "공개로 전환").
