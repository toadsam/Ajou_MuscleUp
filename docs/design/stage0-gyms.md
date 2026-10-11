# 0단계 설계 — "짐(Gym)" 데이터 구조 · 짐별 운영진 · 로그인 계정 연결

2026-10-11 초안. 상위 계획: [../vision.md](../vision.md). **아직 코드 변경 없음 — 이 설계를 확정한 뒤 PR 단위로 진행한다.**
근거(`파일:줄`)는 `backend/src/main/java/com/ajou/muscleup/` 기준.

---

## 0. 지금 상태 요약 (조사 결과)

| 영역 | 지금 | 0단계에서 문제되는 점 |
|---|---|---|
| 모임 | `WorkoutCrew`(주인 · 초대 코드 · 가입 방식) + `WorkoutCrewMember`(LEADER/MEMBER) + 가입 신청 + `CrewChallenge` | 확장 바탕으로 좋음. 단 권한 검사 `ensureLeader` 가 역할을 안 보고 `crew.owner` 만 비교(`CrewServiceImpl.java:660-664`) → 운영진 여러 명 불가 |
| 앱 전체 하나인 것 | `Event` · `CmsEvent`(소식) · `Protein`(공동구매)+신청/메시지 · `Review` · `BragPost` · `Inquiry` · `ProgramApplication` · 갤러리 파일 · 라운지 방 | 짐마다 따로 가져야 하는 것과 모두가 같이 보는 것을 나눠야 함 |
| 관리자 | `ROLE_ADMIN` 하나(`AdminBootstrapRunner.java:40`), `SecurityConfig.java:89-106`, `RoleUtils.isAdmin` 6곳, 문자열 검사 1곳(`ProteinShareServiceImpl.java:153`) | "앱 운영자"와 "짐 운영진"이 섞여 있음 |
| 로그인 | 계정은 **이메일 하나로만** 구분(`AuthController.java:187-195`), 공급자 · 공급자 ID 칸 없음. JWT subject = 이메일(`config/JwtUtil.java:37,49`), 컨트롤러 88곳이 이메일 주체 사용 | 카카오는 이메일을 안 줄 수 있음 |
| 랭킹 · 지표 | 공개 캐릭터 전체 대상(`RankingServiceImpl`, `MetricsServiceImpl.java:26-28`) | 짐별 · 친구 범위 없음 |
| 라운지 | 실시간 방이 `"lounge"` 하나(`realtime/src/rooms.ts:3`) | 짐별 라운지 없음 |
| DB 스키마 | 모든 프로필 `ddl-auto=update`, Flyway 없음 | 테이블 구조 변경 + 데이터 이전을 안전하게 할 수 없음 |
| 화면 | 멤버 · 운영진 명단이 **프론트 코드에 실명으로 박혀 있음**(`frontend/src/pages/Members.tsx:3`, `Executives.tsx:12`), "아주대 · 동아리" 문구 15곳 이상 | 짐마다 달라야 함. 실명은 JS 파일로 누구에게나 내려감 |

**지금 바로 고칠 보안 문제(0단계 첫 PR 에 포함)**
1. ~~모임 상세가 멤버 확인을 안 함~~ → **정정: 이미 막혀 있음**(`CrewServiceImpl.java:329-360` `memberDetailVisible`, 2026-10-11 점검 때 수정). 조사 오류.
2. 동아리 회원 실명 명단이 프론트 번들에 들어 있다(`Members.tsx:3`). 라우트는 로그인 필요여도 JS 파일은 공개. → PR 1 에서 서버로 옮김([../fixes/2026-10-11-roster-privacy.md](../fixes/2026-10-11-roster-privacy.md))

---

## 1. 결정 1 — 짐은 `workout_crews` 를 키워서 만든다 (새 테이블 X)

- 지금 모임이 이미 주인 · 초대 · 가입 승인 · 챌린지를 갖고 있어 **같은 테이블에 칸을 더한다**. 코드 이름 `WorkoutCrew` 는 당분간 유지(화면 · 새 API 에서만 "짐").
- **평평한 구조 + 선택적 부모**: 모든 모임이 짐이다. 아주대 동아리도 짐, 동아리 안 소모임도 짐(`parent_id` = 아주대 짐).
  한 사람이 여러 짐에 속한다(지금도 가능).

### 추가 칸 (`workout_crews`)

| 칸 | 타입 | 뜻 |
|---|---|---|
| `type` | enum `CLUB` · `CREW` · `GYM` · `PT` | 대학 동아리 · 운동 모임 · 헬스장 · 트레이너 |
| `slug` | varchar(40) unique | 주소 `/g/ajou-muscleup` |
| `visibility` | enum `PUBLIC` · `UNLISTED` · `PRIVATE` | 찾기에 노출 / 링크로만 / 초대로만 |
| `parent_id` | FK → workout_crews, null | 동아리 안 소모임 |
| `school_domain` | varchar(60), null | `ajou.ac.kr` — 학교 인증 배지 · 학교 대항 리그 |
| `region` | varchar(40), null | 모임 찾기 |
| `logo_url` · `map_theme` | varchar | 지도 테마(`GYM` 기본, 나중 `TRACK` · `CLIMB` …) |
| `features` | 별도 테이블 `gym_features(gym_id, feature)` | `ATTENDANCE` · `RANKING` · `BOARD` · `EVENTS` · `GROUP_BUY` · `LOUNGE` · `STAFF_PAGE` 켜고 끄기 |
| `member_limit` · `status` | int · enum `ACTIVE`/`ARCHIVED` | 남용 방지 · 삭제 대신 보관 |

### 역할

`WorkoutCrewMemberRole`: `LEADER, MEMBER` → **`OWNER, STAFF, MEMBER`** (+ 표시용 직함 `title` varchar: "회장" · "트레이너").
- 기존 LEADER → OWNER 로 옮긴다.
- 권한은 새 `GymPermissionService.require(user, gymId, action)` 한 곳에서. `ensureLeader` 9곳을 이걸로 바꾼다.

| 할 수 있는 일 | OWNER | STAFF | MEMBER |
|---|---|---|---|
| 설정 · 기능 스위치 · 짐 보관 | ✔ | | |
| 운영진 임명 · 해임 | ✔ | | |
| 가입 승인 · 멤버 내보내기 · 챌린지 · 소식 · 이벤트 · 공동구매 관리 · 신고 처리 | ✔ | ✔ | |
| 멤버 목록 · 출석 현황 · 랭킹 · 게시판 | ✔ | ✔ | ✔ |

앱 운영자(`ROLE_ADMIN`)는 그대로 두고 **모든 짐에 대한 최종 권한**(신고 · 남용 대응)만 갖는다.

## 2. 결정 2 — 무엇을 짐별로 나누나

| 데이터 | 처리 | 이유 |
|---|---|---|
| `cms_events`(소식) · `events`(이벤트) · `program_applications` | `gym_id` 추가(null = 앱 전체 공지) | 동아리마다 소식 · 행사가 다름 |
| `proteins`(공동구매) + 신청 · 메시지 | `gym_id` + 공개 범위 `GYM`(우리 모임만) / `PUBLIC`(전체 모집) — 아래 2-1 | 같은 모임 안에서도, 모르는 사람과도 같이 살 수 있게. 전체 모집은 안전장치를 붙인다 |
| `brag_posts`(자랑방) | `gym_id` null 허용 + 공개 범위에 `GYM` 추가 | 전체 피드는 광장, 짐 피드는 그 짐만 |
| `reviews`(단백질 리뷰) | **전체 유지** | 제품 리뷰는 모두에게 유용 |
| `inquiries` | 전체 유지 + `gym_id` 선택 | 앱 문의 vs 짐 운영진 문의 |
| 출석 · 캐릭터 · 친구 · 채팅 | **사람 단위 유지** | 캐릭터와 출석은 사람마다 하나. 각 짐은 멤버 것을 모아 보여 줌 |
| 랭킹 · 지표 | API 에 범위 `scope=all\|gym:{id}\|friends` | 짐 랭킹 = 그 짐 멤버 중 공개 캐릭터 |
| 갤러리 파일 | 폴더 `gyms/{id}/gallery` | |
| 멤버 · 운영진 페이지 | 프론트 고정 배열 삭제 → `GET /api/gyms/{slug}/members?role=STAFF` | 실명 노출 제거, 짐마다 다름 |
| 라운지 | 실시간 방 `gym:{id}` + 광장 `square` | 입장권(ticket)에 짐 id 를 넣고 서버가 멤버인지 확인 |

## 2-1. 공동구매 — 우리 모임 + 전체 모집 (사용자 요청 2026-10-11)

글을 쓸 때 **모집 범위**를 고른다.

| 범위 | 누가 보나 | 누가 참여하나 |
|---|---|---|
| `GYM` 우리 모임만 | 그 짐 멤버 | 그 짐 멤버 |
| `PUBLIC` 전체 모집 | 모든 사용자(공동구매 목록 "전체" 탭) | 아래 조건을 갖춘 사용자 |

- 칸: `proteins.gym_id`(어느 짐에서 열었나, 개인이면 null) · `visibility GYM|PUBLIC` · `region`(지역) · `pickup_method`(택배 · 직거래 · 모임에서 전달 — 지금 `distributionMethod` 확장) · `max_participants`.
- 목록: "우리 모임" 탭(내 짐들 것) + "전체" 탭(PUBLIC, 지역 · 마감 임박 · 1인 부담 순). 짐 안 글은 그 짐 지도 게시판에도 뜬다.

**전체 모집 안전장치** — 모르는 사람끼리 돈이 오가므로

- 여는 사람 조건: 출석 N회 이상 · 가입 N일 이상(숫자는 운영하며 조정) · 신고 누적 없음. 참여는 로그인만.
- **여는 사람 신뢰 표시**: 완료한 공동구매 수 · 참여자 후기 · 소속 짐 · 학교 인증 배지.
- 결제는 앱이 다루지 않는다(지금처럼 각자 송금). 대신 영수증 올리기(이미 있음) · 단계 표시(모집 → 주문 → 배송 → 완료) · 기한 넘기면 참여자에게 알림.
- 신고 · 차단, 운영자(앱 운영자) 숨김 처리. 계좌번호는 참여 확정자에게만 보이게(지금 영수증 권한과 같은 방식).
- 화면 안내: "앱은 결제를 중개하지 않아요. 송금 전에 신뢰 표시를 확인하세요."
- **확인 필요(법률 자문 아님)**: 모르는 사람끼리의 거래 게시판을 열면 이용약관에 책임 범위 · 금지 품목(의약품 등)을 넣어야 하고, 앱이 거래를 중개하는 형태가 되면 전자상거래법상 고지 의무가 생길 수 있다. 8번 PR(약관) 때 함께 검토.

## 3. 결정 3 — 로그인 계정 연결 (카카오 대비)

- 새 테이블 `social_accounts(id, user_id FK, provider GOOGLE|KAKAO, provider_user_id, email_at_link, created_at)`, unique `(provider, provider_user_id)`.
- Google 로그인: `(GOOGLE, sub)` 로 먼저 찾고, 없으면 지금처럼 이메일로 찾은 뒤 **연결 행을 만든다**(기존 회원 자동 이전).
- 카카오: 카카오 회원번호로 찾는다. **이메일을 안 주면** 내부용 주소 `kakao-{id}@users.musclehub.invalid` 로 만들고 `users.email_placeholder=true` 표시(메일 발송 대상에서 제외).
  지금 로그인 주체가 이메일(JWT subject · 컨트롤러 88곳)이라 0단계에서는 이 방식이 가장 적게 바뀐다.
  **주체를 사용자 id 로 바꾸는 큰 공사는 1단계 뒤로** 미룬다.
- 같은 사람이 Google · 카카오 둘 다 쓰면: 마이페이지 "계정 연결"에서 로그인한 상태로 추가 연결(자동 합치기는 안 함 — 남의 계정에 붙는 사고 방지).

## 4. 결정 4 — 아주대 데이터 옮기기

1. 아주대 짐 1개 생성: `type=CLUB`, `slug=ajou-muscleup`, `school_domain=ajou.ac.kr`, `visibility=PUBLIC`, OWNER = 지금 관리자 계정.
2. **지금 가입자 전원을 아주대 짐 MEMBER 로**(지금은 모두 동아리 앱으로 들어온 사람이므로). 운영진 명단(`Executives.tsx`)에 있는 사람은 사용자가 직접 STAFF 로 지정(이름 → 계정 매칭은 자동으로 하지 않음).
3. 기존 모임들: `type=CREW`, `parent_id`=아주대 짐, LEADER → OWNER.
4. 기존 소식 · 이벤트 · 공동구매 · 프로그램 신청 → `gym_id`=아주대 짐. 기존 공동구매는 `visibility=GYM`(지금처럼 동아리 안에서만 보임).
5. 확인 SQL(옮기기 전후 행 수 · 멤버 수 · 랭킹 1~10위 동일)을 같이 남긴다.

## 5. 결정 5 — Flyway: 지금은 "데이터 이전 전용", 구조는 당분간 Hibernate (PR 2 에서 바꿈)

처음 계획(운영 스키마를 내보내 기준선 → `validate`)은 운영 DB 접근이 필요하고, Hibernate 가 만든 실제 운영 타입
(예: `PostgresSchemaRepairRunner` 가 바꾼 text 칸)과 엔티티가 어긋나면 `validate` 에서 서버가 안 뜰 위험이 있다. 그래서 두 단계로 나눈다.

**지금(PR 2, 적용됨)**
- Spring Boot 기본 Flyway(JPA 보다 먼저 실행)는 끄고(`FlywayAutoConfiguration` 제외), `config/DataMigrationRunner` 가
  **Hibernate(ddl-auto=update)가 테이블을 맞춘 뒤** Flyway 를 돌린다. 웹 서버가 열리기 전에 끝나고, 실패하면 서버가 뜨지 않는다.
- 새 칸 · 테이블 → 엔티티(Hibernate). 그 칸을 채우는 데이터 이전 · Hibernate 가 못 하는 변경(이름 바꾸기 · 제약) → `db/migration` SQL.
- 위치: `db/migration/common` + `db/migration/{mysql|postgresql}`(DB 종류를 연결 정보로 판별). 기존 DB 는 버전 0 으로 기준선 처리.
- 확인: 로컬 MySQL(테스트 DB) · 임시 Postgres 16/17 에서 첫 실행 = 기준선 + V1, 두 번째 실행 = 적용 0, 기존 테이블 그대로.

**나중(1단계 뒤)**
- 운영 스키마를 내보내(사용자, `pg_dump --schema-only`) 엔티티와 비교 → 어긋난 곳 정리 → 운영 `ddl-auto=validate`, 구조 변경도 Flyway 로.
- 운영 DB 백업(사용자가 Railway 에서 스냅샷) 후 배포. **데이터를 바꾸는 이전(V2~)이 들어가는 배포 직전에는 다시 확인받는다.**

## 6. API (새로 · 바뀌는 것)

```text
GET    /api/gyms?type=&q=&school=        공개 짐 찾기
GET    /api/gyms/mine                    내가 속한 짐
POST   /api/gyms                         만들기(type, name, slug, visibility …)
GET    /api/gyms/{slug}                  짐 정보(비공개면 멤버만)
PATCH  /api/gyms/{slug}                  설정 · 기능 스위치(OWNER)
GET    /api/gyms/{slug}/members          멤버(멤버만) · ?role=STAFF 는 공개 운영진 소개
PATCH  /api/gyms/{slug}/members/{userId} 역할 · 직함(OWNER)
GET    /api/rankings/characters?scope=gym:{id}
POST   /api/realtime/ticket { room: "square" | "gym:{id}" }
```
기존 `/api/crew/**` 는 한동안 그대로 동작(내부에서 같은 서비스 호출) → 프론트를 옮긴 뒤 정리.

## 7. 화면

- 헤더에 **짐 전환**(광장 · 아주대 · 내 모임들). 마지막에 본 짐을 기억.
- 홈 지도 = 지금 고른 짐의 지도(광장이면 전체 공개 사용자). 짐 주소 `/g/:slug`.
- 첫 화면 · 공유 미리보기 · 메일 제목에서 "아주대 · Ajou MuscleUp" 제거 → 서비스 이름. 학교 이름은 아주대 짐 안에서만.
- 멤버 · 운영진 페이지 → 짐 페이지 안 탭(API).

## 7-1. 이름이 남은 곳 (중립화 대상)

`About.tsx:104,109` · `Executives.tsx:58` · `Members.tsx:124` · `Events.tsx:93` · `Gallery.tsx:102` · `SupportWidget.tsx:23,40,328` ·
`Header.tsx:179` · `Footer.tsx:18` · `Logo.tsx:10` · `index.html:8-36` · `AttendanceShareView.tsx:824,939` · `utils/attendanceShareCard.ts:313,438` ·
`WriteProtein.tsx:233` · `BragWrite.tsx:518` · 백엔드 `EmailVerificationService.java:54` · `SupportChatService.java:18,54`

## 8. 진행 순서 (PR 단위)

| # | 내용 | 운영 DB 영향 | 사용자 할 일 |
|---|---|---|---|
| 1 | ✅ **보안 급한 것**: 모임 상세 멤버 확인, 실명 명단 번들에서 제거(API 로 이동 전까지 운영진만 보기) | 없음 | – |
| 2 | ✅ **Flyway 도입**(데이터 이전 전용, Hibernate 다음 실행) | `flyway_schema_history` 테이블만 생김 | – (스냅샷 권장) |
| 3 | ✅ 짐 칸 · 역할 · `GymPermissionService` · `/api/gyms` + 아주대 이전 마이그레이션([기록](../fixes/2026-10-11-gyms.md)) | **구조 변경 + 데이터 이전** | 배포 전 확인 · 운영진 지정 |
| 4 | ✅ 공동구매 우리 모임 / 전체 모집 · 짐 안 랭킹([기록](../fixes/2026-10-11-group-buy-scope.md)) | 칸 추가 + 예전 공동구매 이전(V3) | – |
| 5 | ✅ `social_accounts` + Google 연결 이전 + 카카오 로그인 준비([기록](../fixes/2026-10-11-social-accounts.md)) | 테이블 추가 | 카카오 디벨로퍼스 앱 등록 · 키 |
| 6 | ✅ 6-1 이름 · `/g/:slug` · 모임 찾기([기록](../fixes/2026-10-11-brand-and-gym-ui.md)) / ✅ 6-2 헤더 짐 전환 · 소식 · 이벤트 · 프로그램 신청 · 자랑방 `gym_id`(V4, [기록](../fixes/2026-10-11-gym-scoped-content.md)) | 칸 추가 + 예전 소식 · 이벤트 · 신청 이전(V4) | 서비스 이름 결정 |
| 7 | ✅ 실시간 라운지 짐별 방 + 광장([기록](../fixes/2026-10-11-gym-lounge-rooms.md)) | 없음 | – |
| 8 | 약관 · 개인정보 처리방침 · 신고 · 차단 | 테이블 추가 | 문구 검토 |

## 9. 정해야 할 것

1. ~~서비스 이름~~ → **득근득근**(사용자 결정 2026-10-11)
2. 아주대 짐 주소(`ajou-muscleup` 제안)
3. 지금 가입자 전원을 아주대 짐 멤버로 넣어도 되는지
4. 기존 모임들을 아주대 짐의 소모임(`parent_id`)으로 둘지, 독립 짐으로 둘지(제안: 소모임)
5. 짐 만들기를 처음부터 누구나 열지, 신청 → 승인으로 시작할지(제안: 1단계 시범 기간엔 승인제)
