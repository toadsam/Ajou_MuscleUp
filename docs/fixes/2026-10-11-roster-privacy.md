# 2026-10-11 · 0단계 PR 1 — 회원 실명 명단을 서버로 · 모임 상세 노출 재확인

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §0 "지금 바로 고칠 보안 문제".

## 1. 회원 실명 명단이 사이트 JS 파일에 들어 있음 → 서버로 옮김

- **문제**: `/members` 화면은 로그인해야 열리지만, 명단(실명 100여 명)이 `frontend/src/pages/Members.tsx` 의 배열이라
  빌드된 JS 파일(`/assets/Members-*.js`)을 누구나 내려받아 볼 수 있었다. 저장소도 공개(GitHub `toadsam/Ajou_MuscleUp`)라 소스에서도 보였다.
- **원인**: `Members.tsx:3` `const MEMBER_NAMES: readonly string[] = [ … ]` — 화면 보호(ProtectedRoute)는 데이터 보호가 아니다.
- **고친 코드**
  - 백엔드 새 파일
    - `entity/ClubRosterMember.java` — 테이블 `club_roster_members(id, name varchar(30), sort_order, created_at, updated_at)`.
      운영은 `ddl-auto=update` 라 첫 기동 때 자동 생성(0단계 PR 2 Flyway 기준선에 포함 예정).
    - `repository/ClubRosterMemberRepository.java` — `findAllByOrderBySortOrderAsc()`.
    - `service/ClubRosterService.java` — `get()`, `replace(names)`(통째로 교체, 한 트랜잭션), `normalize()`(앞뒤 공백 · 빈 줄 · 중복 제거, 순서 유지, 30자 넘으면 400).
    - `controller/ClubRosterController.java` — `GET /api/club/roster`(로그인 회원), `PUT /api/admin/club/roster`(관리자, 최대 1000명).
    - `dto/club/ClubRosterResponse.java` · `ClubRosterUpdateRequest.java`(record).
  - `config/SecurityConfig.java` — `GET /api/club/roster` 를 USER · ADMIN 으로 명시. PUT 은 기존 `/api/admin/**` ADMIN 규칙.
  - `frontend/src/pages/Members.tsx` — 배열 삭제. 서버에서 받아 그린다(불러오는 중 · 오류 + 다시 시도 · 빈 명단 안내).
    관리자에게만 "명단 고치기"(한 줄에 한 명 textarea → 저장, `toast` 로 결과). 오류 문구는 `httpError`/`friendlyError`.
    ```diff
    - const MEMBER_NAMES: readonly string[] = [ "강…", … ];
    + const res = await fetch(`${API_BASE}/api/club/roster`, { credentials: "include" });
    ```
- **확인**
  - 백엔드 테스트(`local` 프로필) 12개 통과 — 새 `ClubRosterServiceTest`(정리 규칙 2개), `ClubRosterControllerTest`
    (로그인 안 함 → 4xx, 일반 회원 PUT → 403, 관리자 PUT → 정리된 2명 저장 → 회원 GET 순서대로, 테스트 끝나면 되돌림).
  - 로컬 서버: `GET /api/club/roster` · `PUT /api/admin/club/roster` 로그인 없이 → 401.
  - `scripts/verify.sh` 통과, 빌드 결과(`frontend/dist`)에서 명단 속 이름 검색 → 0건.
  - 브라우저: 로그아웃 상태 `/members` → `/login` 으로 이동.
- **남은 것**
  - 로그인한 회원 화면 · 관리자 "명단 고치기"는 Google 로그인이 필요해 화면으로 못 봤다(API 는 테스트로 확인).
  - **배포 직후 운영 DB 명단은 비어 있다** → 관리자가 `/members` → "명단 고치기"에 붙여 넣어야 한다.
    예전 명단은 로컬에서 `git show d9125a2:frontend/src/pages/Members.tsx` 로 볼 수 있다.
  - **공개 저장소의 예전 커밋에는 이름이 그대로 남아 있다.** 지우려면 git 기록을 다시 써야 하고(강제 push, 되돌리기 어려움)
    저장소를 비공개로 돌리는 방법도 있다 — 사용자 결정 필요(roadmap 0장 "git 기록 속 비밀번호 정리"와 같이 결정).

## 2. 모임 상세 노출 — 이미 막혀 있음(조사 정정)

- 설계 조사에서 `GET /api/crew/groups/{id}` 가 멤버 확인을 안 한다고 적었지만, 실제로는 2026-10-11 전체 점검 때 고쳐져 있었다.
  `CrewServiceImpl.buildDetail` 이 멤버가 아니면 멤버 목록 · 개인 출석 · 챌린지 진행 · 경쟁판 · 초대 코드를 비워서 내려보낸다
  (`CrewServiceImpl.java:329-360`, `memberDetailVisible`). 모임 전체 숫자(인원 · 이번 달 합계 · 평균 출석률)만 공개.
- 코드 변경 없음. 설계 문서 §0 을 정정했다.
