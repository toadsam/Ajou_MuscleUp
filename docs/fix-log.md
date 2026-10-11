# 득근득근 수정 기록 (Fix Log)

사용자가 겪은 불편 → 원인 → 고친 방법 → 확인한 방법을 남긴다.
새 항목은 **위에** 추가한다. 형식은 맨 아래 [기록 양식](#기록-양식)을 따른다.

- 브랜치: `design/gym-floor`(merge 됨, PR #5) → `design/gym-map`
- 작업 방식: Claude Code 와 페어 작업. 규칙은 저장소 루트 `CLAUDE.md`.

---

## 2026-10-11 · PR #11 미리보기 빌드 실패(TS2304 Response) — 로컬은 통과

**불편**
Vercel 빌드가 `vite.config.ts(68,124): error TS2304: Cannot find name 'Response'` 로 멈췄다. 로컬 `tsc -b --force` 와 `verify.sh` 는 통과했다(`console` TS2584 때도 같은 일).

**원인(근거)**
- 이 PC 의 상위 폴더 `C:/Users/jk636/node_modules/@types/node` 를 TypeScript 가 자동으로 끌어왔다(`tsc --explainFiles` 에 `../../…/node_modules/@types/node` · `@types/prop-types`). 그래서 `Response` · `console` 같은 Node 전역 타입이 로컬에만 있었다.
- 프로젝트에는 `@types/node` 가 없어 Vercel 에선 없음 → 실패.

**고친 방법**
- `frontend/package.json`: `@types/node` ^22 를 devDependencies 에 추가(Vite 템플릿과 같은 방식) — 로컬 · Vercel 이 같은 타입.
- `tsconfig.node.json` `"types": ["node"]`, `tsconfig.app.json` `"types": []` — 상위 폴더 `@types` 자동 포함 차단.
- `vite.config.ts`: 서비스 워커용 함수 반환 타입에 `Response` 이름을 쓰지 않음.

**확인한 방법**
- `tsc --explainFiles` 에서 상위 폴더 파일 0개(node · app), `tsc -b --force` 0 오류, `verify.sh` 통과.

**아직 못 한 것**
- Vercel 미리보기 빌드 재실행 결과 확인.

---

## 2026-10-11 · 배포 직후 예전 화면이 뜨고 "서버에 연결하지 못했어요"

**불편**
PR #10 배포 뒤 공동구매 화면을 열면 예전 화면(`index-BWppK04T.js`)이 뜨고 "서버에 연결하지 못했어요" 가 보였다. 새로고침 · 다시 열기를 거쳐 **세 번째 접속**에야 새 화면(`index-D2PRLEcG.js`)으로 바뀌었다(사용자 Chrome 에서 측정).

**원인(근거)**
- `vite.config.ts` 의 `navigateFallback: '/index.html'` — 서비스 워커가 첫 화면 HTML 을 **저장본에서 먼저** 내줬다. 새 서비스 워커가 설치 · 교체된 뒤에야 새 HTML 이 나와 두세 번 걸렸다(측정 시 저장소에는 이미 새 `index.html` 이 들어와 있었는데 화면은 예전 것).
- `vercel.json` 이 모든 주소를 `index.html` 로 돌려, 예전 화면이 이미 지워진 조각 파일(`/assets/*.js`)을 찾으면 404 대신 HTML 이 와서 화면 일부가 깨질 수 있었다.
- 지워진 조각 파일을 만났을 때 다시 받는 처리(`vite:preloadError`)가 없었다.

**고친 방법**
- `frontend/vite.config.ts`: `navigateFallback: null` + 화면 이동 요청은 `NetworkFirst`(4초) — 항상 서버에서 먼저 받고, 못 닿으면(오프라인) 미리 받아 둔 `index.html` 을 보여 준다(`handlerDidError`). `cleanupOutdatedCaches: true`.
- `frontend/src/main.tsx`: `vite:preloadError` 때 한 번만 새로고침(10초 안 반복 방지).
- `frontend/vercel.json`: `/assets/` · 아이콘 · 서비스 워커 파일은 `index.html` 로 돌리지 않음(없으면 404), `/assets/*` 1년 immutable, `sw.js` · `index.html` · manifest 는 no-cache.
- (같이) 공동구매 작성 폼의 기본 모임을 동아리(CLUB)로(`WriteProtein.tsx`) — 먼저 만들어진 소모임이 골라지던 것.
- `.claude/launch.json` 에 빌드본 미리보기 `frontend-built`(4173) 추가.

**확인한 방법**
- 빌드본을 사용자 Chrome 에서 `localhost:4173` 으로 열어 서비스 워커 · 저장소(precache)가 있는 상태를 만든 뒤, 코드를 바꿔 다시 빌드(= 새 배포) → **한 번 접속에 새 화면**(`D7DooEJ_` → `CEYMAuFH`), 저장소는 그대로.
- 만들어진 `sw.js` 에 NetworkFirst 화면 규칙 · 오프라인 대체가 들어간 것 확인. `verify.sh` 통과.
- 주의: 앱 안 미리보기 브라우저는 새로고침마다 Cache Storage 를 비운다(시험 값까지 사라짐) → 서비스 워커 시험은 Chrome 에서 해야 한다(CLAUDE.md 함정에 추가).

**아직 못 한 것**
- 오프라인 대체 화면(네트워크 끊김)은 직접 끊어 보지 못했다. `vite:preloadError` 새로고침도 실제 배포 전환에서 확인 필요.
- 이번 배포 직후 한 번은 여전히 예전 서비스 워커 규칙으로 동작한다(새 규칙이 설치된 뒤부터 적용).
- (후속) 시험 중 `main.tsx` 작업 사본의 줄바꿈이 LF 로 바뀐 것을 CRLF · BOM 으로 되돌렸다(저장소 내용 변화 없음).

---

## 2026-10-11 · 공동구매를 우리 모임 안에서도, 전체로도 모집하고 싶음 · 모임 안 랭킹

**불편**
공동구매는 앱 전체에 하나뿐이라, 우리 모임끼리만 사거나 모르는 사람과 크게 모집하는 걸 고를 수 없었다. 랭킹도 앱 전체 순위뿐이었다.

**원인(근거)**
- `Protein` 에 모임 · 모집 범위가 없고 목록은 전체 글(`ProteinServiceImpl.list`), 랭킹은 공개 캐릭터 전체(`RankingServiceImpl`).

**고친 방법**
- 공동구매에 모임 · 모집 범위(우리 모임만 / 전체 모집) · 지역 · 최대 인원. 규칙은 `GroupBuyAccess` 한 곳(우리 모임 글은 멤버만 보고 신청, 전체 모집은 가입 7일 · 운동 3일 이후에 열기).
- 목록 `scope=all|gym|public`, 상세에 여는 사람 신뢰 표시, 최대 인원이 차면 신청 · 승인 거절.
- 랭킹 `?gym=슬러그` — 그 모임 멤버 안에서의 순위(멤버만).
- 데이터 이전 V3: 예전 공동구매 → 아주대 짐의 "우리 모임만".
- 코드 단위 기록: [fixes/2026-10-11-group-buy-scope.md](fixes/2026-10-11-group-buy-scope.md)

**확인한 방법**
- 백엔드 테스트 20개(새 범위 · 권한 테스트 3개) — 로컬 MySQL 과 임시 Postgres 둘 다 통과. Postgres 에서만 나던 검색어 null 오류를 찾아 수정.

**아직 못 한 것**
- 화면(목록 탭 · 작성 폼의 모집 범위 · 상세 신뢰 표시 · 랭킹 범위)은 만들고 verify 통과, 로그인이 필요해 브라우저로는 못 봄.
- 소식 · 이벤트 · 자랑방의 모임 구분은 PR 6 으로 옮김.

---

## 2026-10-11 · 동아리 하나만 담을 수 있는 구조 → 짐(Gym) 구조 · 짐별 운영진

**불편**
앱이 아주대 동아리 하나만 전제로 만들어져, 다른 동아리 · 모임 · 헬스장이 쓸 수 없었다. 모임 관리도 모임장 한 명만 가능해 운영진을 둘 수 없었다.

**원인(근거)**
- 모임(`WorkoutCrew`)에 종류 · 공개 범위 · 상태가 없고, 권한은 `ensureLeader` 가 주인 id 만 비교(`CrewServiceImpl.java:660-664`).
- 멤버 역할은 LEADER · MEMBER 뿐, 화면에 코드 값이 그대로 보였다(`CrewChallenge.tsx:1059,1088`).

**고친 방법**
- `WorkoutCrew` 를 짐으로 확장(종류 · 주소 · 공개 범위 · 상태 · 부모 · 학교 · 기능), 역할 OWNER · STAFF · MEMBER + 직함.
- 권한을 `GymPermissionService` 한 곳으로, 짐 API `/api/gyms`(+ 운영자 승인 `/api/admin/gyms`).
- 데이터 이전 V2: 역할 제약 풀기 · LEADER → OWNER · 아주대 짐 생성 · 전원 멤버 · 기존 모임을 소모임으로.
- 코드 단위 기록: [fixes/2026-10-11-gyms.md](fixes/2026-10-11-gyms.md)

**확인한 방법**
- 백엔드 테스트 17개(권한 경계 포함), 임시 Postgres 에 옛 상태를 넣고 이전 → 결과 SQL 확인 · 2차 적용 0, 로컬 MySQL 이전 · API 응답, 프론트 verify 통과.

**아직 못 한 것**
- 운영 배포는 데이터 변경이 있어 Railway 스냅샷 후 진행해야 함.
- 로그인 화면 확인, 모임장 넘기기, 새 가입자 짐 선택(PR 6).

---

## 2026-10-11 · DB 데이터를 안전하게 옮길 방법이 없음 (Flyway 도입)

**불편**
짐 구조로 바꾸려면 운영 DB 의 기존 데이터를 옮겨야 하는데(아주대 짐 만들기 등), 지금은 Hibernate 가 테이블만 맞출 뿐 데이터 이전을 한 번만 · 기록 남기며 할 방법이 없었다.

**원인(근거)**
- 모든 프로필 `ddl-auto=update`, Flyway · Liquibase 없음(`build.gradle`).

**고친 방법**
- Flyway 를 **Hibernate 다음에** 도는 데이터 이전 전용으로 도입(`config/DataMigrationRunner`, Boot 기본 Flyway 는 제외). 구조는 당분간 Hibernate.
- SQL 위치 `db/migration/common` · `db/migration/{mysql|postgresql}`, 기존 DB 는 버전 0 기준선.
- 코드 단위 기록: [fixes/2026-10-11-flyway-data-migrations.md](fixes/2026-10-11-flyway-data-migrations.md)

**확인한 방법**
- 백엔드 테스트 통과(MySQL), 임시 Postgres 에서 1차 기준선 + V1 · 2차 적용 0.

**아직 못 한 것**
- 운영 Postgres 배포는 아직(첫 배포 때 기록 테이블만 생김).
- 운영 `ddl-auto=validate` 전환은 나중.

---

## 2026-10-11 · 회원 실명 명단이 누구나 받을 수 있는 JS 파일에 들어 있음

**불편**
`/members` 는 로그인해야 열리지만, 동아리 회원 실명 명단이 사이트 JS 파일에 그대로 들어 있어 로그인하지 않은 사람도 파일을 열어 볼 수 있었다(공개 저장소 소스에도 있음).

**원인(근거)**
- `frontend/src/pages/Members.tsx:3` 의 고정 배열. 화면 보호(ProtectedRoute)는 데이터를 숨기지 못한다.

**고친 방법**
- 명단을 DB(`club_roster_members`)로 옮기고 `GET /api/club/roster`(로그인 회원) · `PUT /api/admin/club/roster`(관리자) 추가.
- 화면은 서버에서 받아 그리고, 관리자에게만 "명단 고치기"(한 줄에 한 명).
- 설계 조사에서 문제로 적은 "모임 상세 노출"은 이미 고쳐져 있음을 확인(코드 변경 없음, 설계 문서 정정).
- 코드 단위 기록: [fixes/2026-10-11-roster-privacy.md](fixes/2026-10-11-roster-privacy.md)

**확인한 방법**
- 백엔드 테스트 12개 통과(권한 3 · 정리 규칙 2 포함), 로그인 없이 두 API → 401, 빌드 결과에서 이름 검색 0건, 로그아웃 `/members` → `/login`.

**아직 못 한 것**
- 로그인 회원 화면 · 관리자 편집 화면은 로그인이 필요해 못 봄.
- 배포 직후 운영 명단은 비어 있음 → 관리자가 붙여 넣어야 함.
- 공개 저장소 예전 커밋의 명단은 남아 있음(기록 다시 쓰기 또는 비공개 전환 — 사용자 결정).

---

## 2026-10-11 · 로그인 없이 지도 체험 + S 계열 MBTI 캐릭터 색

**불편**
처음 온 사람은 로그인 전 홈에서 "LV – · 0/7 · 0일" 빈 지도만 보고, 무엇을 하는 곳인지 느끼기 전에 로그인부터 요구받았다.
또 ISTJ · ESTP 같은 S 계열 MBTI 회원은 캐릭터가 정해진 색이 아니라 회색 민소매로 나왔다.

**원인(근거)**
- 로그인 전 지도는 모든 시트가 "로그인" 버튼뿐이고 체험할 수 있는 행동이 없었다(`GymMap.tsx` checkin/mirror 시트).
- 색 규칙이 `includes("SJ")` · `includes("SP")` 로 찾았는데 4글자 MBTI 에서 S 와 J/P 는 붙어 있지 않다(`AvatarRenderer.tsx:31-34`, `engine.ts:77-80`).

**고친 방법**
- 로그인 전 첫 진입에 지도 위 "내 캐릭터부터 만들어요" 창(성별 · MBTI) → 체크기로 걸어가 "원판 꽂아 보기"(기록 없음) → 원판이 꽂히는 연출 뒤 "Google로 시작하기".
- 체험 캐릭터는 이 기기에만 저장(`guestCharacter.ts`). 가입 뒤 마이페이지 스탯 입력칸을 성별 · MBTI 로 미리 채우고, 저장하면 지운다.
- 새 `avatar/mbti.ts` `temperament()` 로 기질을 정확히 계산(두 파일 모두).
- 측정 이벤트 4개(`guest_create` · `guest_skip` · `guest_trial_checkin` · `guest_signup_click`).
- 코드 단위 기록: [fixes/2026-10-11-guest-map-trial.md](fixes/2026-10-11-guest-map-trial.md)

**확인한 방법**
- `tsc -b --force` · 빌드 통과, 바뀐 파일 린트 증가 없음.
- 로그아웃 상태 브라우저 375px · 데스크톱: 만들기 → 걸어가기 → 원판 꽂기(0/7 → 1/7) → 가입 안내, 새로고침 뒤 유지, 거울 "다시 만들기", ESTP 빨간 민소매.

**아직 못 한 것**
- 가입 뒤 마이페이지 이어받기는 로그인이 필요해 화면으로 확인 못 함.
- 실제 휴대폰에서 걷는 속도 · 진동 체감.

---

## 2026-10-11 · PR #6 을 merge 했는데 사이트에 반영이 안 됨 (Vercel 빌드 실패)

**불편**
merge 뒤에도 musclehub.co.kr 은 예전 화면 그대로였다. 백엔드·실시간 서버(Railway)는 새 코드로 배포돼서, 예전 화면과 새 서버가 섞여 라운지 · 친구 채팅이 막힐 수 있는 상태가 됐다.

**원인(근거)**
- Vercel 빌드 로그: `vite.config.ts(21,5): error TS2584: Cannot find name 'console'` → `npm run build`(= `tsc -b && vite build`) 종료 코드 2.
- 이번 점검에서 `vite.config.ts` 에 넣은 환경변수 검사의 `console.warn` 때문. `tsconfig.node.json` 은 `lib: ["ES2023"]` 뿐이라 DOM 의 `console` 타입이 없다.
- 로컬에서는 `node_modules/.tmp` 의 증분 빌드 정보가 남아 `tsc -b` 가 다시 검사하지 않아 통과했고, `scripts/verify.sh` 는 `tsconfig.app.json` 만 검사해서 `vite.config.ts` 를 보지 않았다.

**고친 방법**
- `frontend/vite.config.ts`: `console.warn(message)` → `(globalThis as { console?: … }).console?.warn(message)`.
- `scripts/verify.sh`: 타입 검사를 `npx tsc -b --force` 로 바꿔 Vercel 과 같은 범위(앱 + 설정 파일)를 캐시 없이 검사.

**확인한 방법**
- `node_modules/.tmp` 를 지우고 `npx tsc -b --force` 0 오류, `vite build` 통과.
- `main` push(`ee17b9f`) 후 Vercel 배포 성공, musclehub.co.kr 이 새 화면(`index-BWppK04T.js`, 지도 · NPC 3명)으로 바뀐 것 확인. 예전에 방문한 브라우저는 서비스 워커가 새 파일을 받은 뒤 한 번 더 새로고침해야 바뀐다.
- **운영 점검에서 새로 찾은 것(설정 문제, 코드 아님)**:
  - 프론트의 실시간 서버 주소 `VITE_REALTIME_URL` 이 `https://api.musclehub.co.kr` 인데 이 도메인은 DNS 에 없다(구글 DNS 도 Non-existent domain). 실제 실시간 서버는 Railway `adaptable-motivation-production-3c65.up.railway.app`. → 라운지 · 친구 실시간이 운영에서 붙지 않는다(이번 배포 전부터였을 가능성이 크다).
  - 운영 실시간 서버에 `REALTIME_TICKET_SECRET` 이 없어 모든 연결을 `realtime_unavailable` 로 거절한다(직접 접속해 확인).
  - 해결은 사용자가 대시보드에서: Railway 백엔드 · 실시간 서버에 같은 `REALTIME_TICKET_SECRET`, 실시간 서버에 `ORIGIN`, Vercel `VITE_REALTIME_URL` 을 실제 주소로(또는 `api.musclehub.co.kr` DNS 를 실시간 서버로 연결) → Vercel 재배포.

---

## 2026-10-11 · 지도가 내 캐릭터 말고는 멈춰 있어 헬스장이 비어 보인다 → 직원 NPC

**불편**
홈 지도에서 움직이는 건 내 캐릭터뿐이라 "살아 있는 헬스장" 느낌이 약했다. 사용자가 "지속적으로 움직이는 AI 를 넣고 싶다"고 했다.

**원인(설계 판단)**
처음 지도를 옮길 때 시안의 가짜 회원(이름 · 레벨 · 말풍선)을 뺐다. 실제 라운지 인원과 섞이면 "사람 많네"로 오해하게 되기 때문. 그래서 회원이 아니라 **헬스장 직원**으로 넣었다.

**고친 방법**
- [gymMap/engine.ts](../frontend/src/components/gymMap/engine.ts): `NPC_PLANS` · `updateNpcs` · `drawNpc`.
  - 코치: 플랫폼과 가운데 바닥을 무작위로 돌아다님(1.5~4초 쉼, 호루라기).
  - 관장님: 카운터 옆 → 출석 체크기 앞 → 게시판 앞을 천천히 순회(4~8초 쉼).
  - 직원: 아래쪽 바닥을 사각형으로 돌며 걸레질(걸레가 걸음에 맞춰 흔들림).
  - 모두 같은 노란 조끼 유니폼. 내 캐릭터가 1.3칸 안에 오거나 말하는 중이면 멈춰서 쳐다본다.
  - NPC 를 누르면 내 캐릭터가 그 옆 칸으로 걸어가고 NPC 가 말한다(`onNpcTalk`). 회원처럼 길을 막지는 않는다.
- [gymMap/GymMap.tsx](../frontend/src/components/gymMap/GymMap.tsx): 역할 이름표(노란 테두리, 닉네임·레벨 없음), 화이트보드색 말풍선 3.4초.
  - 대사는 내 **실제 기록**으로: 관장님 = 오늘 출석 여부 · 연속 일수, 코치 = 이번 주 남은 날(7 − 운동한 날) 또는 운동 팁, 직원 = 안내 문구. 지어낸 숫자 없음.
  - 15초마다 코치나 직원이 혼잣말(탭이 숨겨졌거나 누가 말하는 중이면 쉼, 동작 줄이기 설정이면 끔).
- `gymMap.css`: `.gm-npc`, `.gm-bubble`.

**확인한 방법**
- 타입 검사 0, 린트 증가 없음.
- 미리보기(로그인 전)에서 세 명의 이름표가 지도 위에 뜨는 것, 코치를 누르면 "코치 세트 사이 휴식은 1~2분이면 충분해요." 말풍선이 생기는 것을 확인.
- **아직 못 한 것**: 미리보기 창이 가려져 애니메이션이 멈춘 상태라 실제로 걸어 다니는 모습은 화면으로 못 봤다. 로그인 상태 대사(연속 일수 · 남은 날), 휴대폰 터치.

---

## 2026-10-11 · 앱 전체 점검 후 일괄 수정 — 보안 · 막힘 · 가짜 숫자 · 문구 · 성능

**불편**
사용자가 "앱 전체에서 바꿔야 할 것을 다 말해 달라"고 했고, 점검 결과(보안 11 · 버그/막힘 13 · 구조 7 · 가짜 숫자/문구 6 · 문구/디자인 6 · 성능 7)를 모두 고치기로 했다.

**원인**
화면 확인(로그인 상태 크롬) + 코드 점검(프론트 40건, 백엔드·실시간 30건). 항목별 근거(`파일:줄`)는 세부 기록에 있다.

**고친 방법**
- 영역별 세부 기록(어떤 코드를 어떻게 바꿨는지): [docs/fixes/](fixes/README.md)
- 공용 부품 추가: `frontend/src/lib/toast.ts`(alert 대신 토스트), `frontend/src/lib/httpError.ts`("HTTP 500"·서버 원문·영어 오류 → 한국어 문장).
- `hooks/useCountUp.ts`: 탭이 숨겨져 있으면 requestAnimationFrame 이 멈춰 숫자가 0 에 머물렀다(운동 모임 화면 위쪽 "내 모임 0 · 전체 0"의 원인, 백엔드 점검에서 확인). 숨겨진 탭이면 바로 목표 값, 그 밖에도 `duration+150ms` 뒤 목표 값으로 맞추는 안전장치.
- 영역 사이 마무리(메인 세션):
  - 리프레시 토큰이 httpOnly 쿠키로만 오가게 바뀌어, `Login.tsx`(`storeSession`), `ProtectedRoute.tsx`, `Header.tsx` 에 남아 있던 `refreshToken` 저장·복사 줄을 지웠다.
  - `JwtUtil.java`: 코드는 `jwt.access-expiration-ms` 를, 설정 파일은 `jwt.access.expiration-ms` 를 써서 설정값이 무시되고 코드 기본값이 쓰였다 → 두 이름 모두 읽게(`${jwt.access.expiration-ms:${jwt.access-expiration-ms:900000}}`, refresh 도 같음). 운영 값은 기본값과 같아 동작 변화 없음, 로컬은 리프레시 14일로 바뀜.
  - `Home.tsx`: 실시간 서버 주소를 `lib/realtime.ts` 의 `REALTIME_URL` 로 통일, 배포에 없으면 라운지 인원 조회를 건너뜀. "운동모임" → "운동 모임".
- 이름 통일(제품 결정): 운동 모임 · 공동구매 · 응원. 홈 지도(`gymMap/GymMap.tsx`, `engine.ts`)의 "운동모임/크루" 문구를 "운동 모임/모임"으로.
- 사용자 결정: 안 쓰는 파일 삭제 허용, 멤버 명단은 로그인한 사람만, 갤러리 "촬영 문의" 버튼 제거.

**확인한 방법**
- 영역 여섯 개 모두 완료. 각 기록에 항목별 diff 와 확인 결과가 있다:
  [backend-security](fixes/2026-10-11-backend-security.md) · [backend-data](fixes/2026-10-11-backend-data.md) · [realtime-lounge](fixes/2026-10-11-realtime-lounge.md) · [frontend-shell](fixes/2026-10-11-frontend-shell.md) · [frontend-pages](fixes/2026-10-11-frontend-pages.md) · [frontend-community](fixes/2026-10-11-frontend-community.md)
- `bash scripts/verify.sh`: 타입 0 오류, 바뀐 파일 린트 증가 없음, 빌드 통과.
- 백엔드 `test`(local 프로필) 7개 통과(새 `RefreshTokenServiceTest` 5개 포함). 실시간 서버 `tsc` · `build` 통과.
- 새 코드로 서버 재시작 후 직접 호출: 입장권 발급 로그인 없이 401, `/actuator/health` 401, 허용 안 된 출처 CORS 403, 로비 지표 200.
- 로그인 상태(사용자 크롬):
  - 출석 화면에서 "오늘의 운동 체크"가 맨 위.
  - 베타 안내 "닫기" 뒤 다른 화면에서 다시 안 뜸.
  - 운동 모임 위쪽 숫자가 목록과 일치(내 모임 2 · 전체 2 · 참여 3).
  - 캐릭터 응답에 경험치(`exp 20 / 다음 레벨까지 80 · 진행 0.2`).
  - 라운지가 입장권으로 접속(실시간 서버 로그 `join p09cb… level=88 tier=MASTER` — 이메일 대신 공개 id, 레벨은 서버가 보증), 게임 화면이 맨 위, 캐릭터 머리 위 "다시 시작해요".
- **아직 못 한 것**:
  - Google 로그인 직후부터 15분 넘게 지나서 자동 갱신(쿠키 회전)되는지.
  - 두 계정으로 친구 검색 · 1:1 채팅.
  - 관리자 화면.
  - 카카오톡 인앱 브라우저 안내(실기기).
  - 공동구매 영수증 권한.
  - 휴대폰 실기기.
- **사용자가 직접 할 일**:
  - Gmail 앱 비밀번호 재발급.
  - DB 비밀번호 · 운영 `JWT_SECRET` 교체(예전 값이 git 기록에 있음).
  - 배포 환경변수: 백엔드+실시간 `REALTIME_TICKET_SECRET`(같은 값, 32자 이상), 실시간 `NODE_ENV=production` · `ORIGIN`, 프론트 `VITE_API_BASE` · `VITE_REALTIME_URL`(없으면 배포 빌드가 멈춤), `CORS_ALLOWED_ORIGINS` 는 정확한 주소만.
  - 운영 서버 시간대 확인(UTC 였다면 저장 시각이 9시간 어긋남).
  - 예전 공동구매 영수증 파일(공개 갤러리 폴더) 처리.
  - git 기록 정리는 따로 결정.

---

## 2026-10-11 · 메인 화면이 "카드 쌓인 웹페이지"라 게임 느낌이 겉모습에서 멈춘다 → 헬스장 지도

**불편**
짐 플로어(v2)로 질감과 색은 바뀌었지만 첫 화면은 여전히 카드가 위아래로 쌓인 페이지였다. 출석을 해도 게임처럼 터지는 순간이 없고, 로그인 전에는 캐릭터 자리가 빈 박스로 보였다. 사용자가 시안(claude.ai 아티팩트 "득근 헬스장 지도")을 보고 이 방향을 골랐다.

**원인(디자인 판단)**
- 앱의 핵심 루프(출석 → 캐릭터 → 라운지)가 화면 구조에 드러나지 않고 링크 목록으로만 있었다.
- 출석 완료 반응(`showReaction`)이 체크 표시가 잠깐 튀는 정도였다.

**고친 방법**
- 홈 첫 화면 오른쪽(모바일은 제목 아래)의 "이번 주 바벨" 자리를 **위에서 내려다본 픽셀 헬스장**으로 바꿨다.
  - [components/gymMap/engine.ts](../frontend/src/components/gymMap/engine.ts): 캔버스 256×416(16×26칸) 그림, 칸 단위 길찾기(BFS), 걷기, 출석 연출. React 와 분리.
  - [components/gymMap/GymMap.tsx](../frontend/src/components/gymMap/GymMap.tsx) + `gymMap.css`: HUD(레벨 · 이번 주 원판 7칸 · 연속 출석), 장소 이름표, 기구 앞에 서면 올라오는 창, 바로 가기 4개.
- 장소 → 기존 화면(라우트는 그대로): 출석 체크기 `/attendance` · 파워랙 `/mypage` · 거울 `/mypage`(내 캐릭터 그대로 표시) · 화이트보드 `/events`(진행 중 이벤트 3개) · 라운지 `/lounge` · 러닝머신 `/crew` · 게시판 `/brag` 등.
- **지도에 그리는 건 실제 데이터만**: 바벨 원판 = 이번 주 운동한 날(기존 `weekStats.workoutDays`, 색 순서 `gym/plates.ts`), 출석 체크기 화면 = 오늘 출석 여부, 라운지 벤치에 앉은 사람 = 실시간 라운지 인원(최대 3명, 이름 없음), 내 캐릭터 색 = MBTI 계열(AvatarRenderer 규칙과 같음). 시안의 가짜 이름·말풍선·경험치는 넣지 않았다(API 에 경험치가 없어서 HUD 는 "이번 주 원판"으로 바꿈).
- 출석하고 홈으로 돌아오면(기존 `attendanceCompletedAt` 신호) 출석 체크기 앞에서 원판이 날아가 바벨에 꽂히고, 화면이 흔들리고, 캐릭터가 바벨을 머리 위로 든다. `prefers-reduced-motion` 이면 흔들림 · 가루 없음.
- 닫힌 아래 창이 내용 없이 지도 바닥에 얇은 띠로 비칠 수 있어(로그인 상태 크롬에서 발견) 닫혀 있을 땐 `visibility: hidden` 으로 완전히 숨김.
- 노트북 화면(높이 731px)에서 지도 위쪽이 잘려 보여, 데스크톱에서는 화면 높이에 맞춰 지도 폭을 줄인다(`.hero-map .gm-app`, 최소 300px).
- 걷는 속도: 처음 1초에 7칸 → 사용자가 "더 빠르게"를 요청해 **13칸**으로(`WALK_SPEED`, 다리 움직임도 같이 빠르게). 입구에서 출석 체크기까지 약 0.3초, 지도 끝에서 끝까지 약 2초.
- 걷는 게 느리다는 단점은 아래 **바로 가기**(걷지 않고 0.5초 안에 이동해 창 열기)로 메웠다. 모바일 하단 고정 버튼(출석하기 · 운동모임)도 그대로 둔다.
- 모바일에서는 히어로 설명문과 버튼을 숨겨 지도가 첫 화면에 바로 보이게 했다(같은 버튼이 바로 가기와 하단 고정 버튼에 있다).

**확인한 방법**
- `bash scripts/verify.sh`: 타입 0 오류, 바뀐 파일 린트 증가 없음, 빌드 통과.
- 로그인 없이 브라우저(데스크톱 1280px · 모바일 375px)에서: 지도 그리기, 장소 이름표 누르기 → 캐릭터가 길을 따라 걸어가 노란 테두리 + 아래 창 열림(출석 체크기 · 라운지), 모바일 가로 스크롤 없음(문서 폭 375).
- **아직 못 한 것**
  - 로그인 상태(사용자 크롬): HUD 에 실제 레벨(LV 88) · 이번 주 0/7 · 연속 0일이 나오는 것은 확인. 크롬 창이 뒤에 가려져(`visibilityState: hidden`) 애니메이션이 멈춰 있어서 **걷기 · 거울 속 캐릭터 · 출석 후 원판 연출**은 아직 못 봤다.
  - 실제 휴대폰에서 터치 · 진동.
  - 실시간 서버가 꺼져 있어 라운지 벤치에 사람이 앉는 모습은 못 봤다(인원 0 → 빈 벤치).

---

## 2026-10-11 · 하네스 구성 — 수정할 때마다 기록·검증이 빠지지 않게

**불편** 고친 내용이 대화에만 남고 저장소에는 "무엇이 왜 바뀌었는지"가 남지 않았다. 검증도 그때그때 손으로 해서 빠뜨리기 쉬웠다.

**고친 방법**
- [CLAUDE.md](../CLAUDE.md): 작업 루프(원인 증명 → 수정 → 검증 → 화면 확인 → 기록), 로컬 실행법, 디자인 시스템 규칙, 알려진 함정.
- [scripts/verify.sh](../scripts/verify.sh): 타입 검사 + 바뀐 파일 린트를 원본(HEAD)과 비교([frontend/scripts/lint-diff.mjs](../frontend/scripts/lint-diff.mjs), ESLint API 로 한 프로세스에서) + 빌드. 처음엔 파일마다 eslint 를 따로 띄워 10분을 넘겨서 바꿨다.
- [.claude/hooks/require-fix-log.sh](../.claude/hooks/require-fix-log.sh) + [.claude/settings.json](../.claude/settings.json): Stop 훅. `frontend/src`·`backend/src` 파일이 이 기록보다 새것이면 Claude 가 작업을 끝내지 못하고 기록을 먼저 쓰게 한다(한 번 이어 쓴 뒤엔 다시 막지 않음).
- `.claude/launch.json`: 프론트·백엔드(local 프로필)·실시간 서버 실행 설정. `.claude/settings.local.json`(개인 설정)은 `.gitignore` 에 추가.

**확인한 방법**
- 훅을 표준입력으로 시험: 기록이 최신 → 통과(0), 코드가 더 새것 → 차단(2)과 파일 목록 안내, 이어 쓰는 중(`stop_hook_active`) → 통과(0).
- `bash scripts/verify.sh --quick` 42초, 바뀐 파일 62개 전부 "늘어난 파일 없음", ✅ 통과. 빌드 포함 약 1분 15초.
- **아직 못 한 것**: 훅은 새 설정을 읽는 다음 세션부터 동작할 수 있다.

---

## 2026-10-11 · 출석 인증 카드 공유가 매번 "차단되었거나 취소되었습니다"로 실패

**불편**
출석하고 사진을 찍은 뒤 "원클릭 공유"를 누르면 `자동 공유가 차단되었거나 취소되었습니다` 알림이 계속 떴다. 다시 눌러도 또 떴다. 사용자가 많이 빠져나간 지점으로 본다.

**원인**
브라우저는 사용자가 **방금** 버튼을 누른 직후에만 공유 창(`navigator.share`)을 열어 준다(transient user activation). 기존 흐름은 이 조건을 세 번 깼다.

1. 출석 화면 `quickShare`([Attendance.tsx](../frontend/src/pages/Attendance.tsx))가 서버에서 공유 링크를 받은 **뒤에**(`await ensureShareSlug()`) `window.open` 으로 새 탭을 열었다. 이미 기다린 뒤라 모바일에서는 팝업 차단에 걸리기 쉬웠다.
2. 새 탭은 `?auto=share` 로 열렸고, 페이지가 로드되고 사진이 준비되면 **아무도 누르지 않았는데** `quickShare()` 를 불렀다. Web Share 규칙상 항상 `NotAllowedError` → 그 알림.
3. 사용자가 직접 다시 눌러도, 공유 창을 열기 전에 1080×1350 카드를 html2canvas 로 2.5~3배 해상도로 렌더링했다. 측정값(PC): 렌더 850ms + PNG 600ms = **1.45초**, 2700×3375. 폰에서는 몇 배 더 걸려 활성화 인정이 만료됐다.
4. 사용자가 공유 창을 그냥 닫아도(`AbortError`) 같은 알림이 떴다. 취소와 차단을 구분하지 않았다.

**고친 방법** — [AttendanceShareView.tsx](../frontend/src/pages/AttendanceShareView.tsx), [Attendance.tsx](../frontend/src/pages/Attendance.tsx)
- **카드 이미지를 미리 만든다.** 카드 모양(`cardSignature`)이 바뀌면 400ms 뒤 백그라운드에서 렌더링해 `preparedFile` 에 보관한다.
- **공유 버튼은 기다리지 않는다.** `quickShare` 안에서 `navigator.share` 를 호출하기 전에 `await` 가 하나도 없다. 준비 중일 때는 버튼이 "카드 준비 중..."으로 잠긴다.
- **자동 공유를 없앴다.** `?auto=share` 로 들어오면 공유를 시도하지 않고, 카드가 준비되면 "카드가 준비됐어요. 공유하기를 눌러 주세요" 안내와 함께 버튼을 노란 테두리로 깜빡인다. (`?auto=save` 는 다운로드라 사용자 조작이 필요 없어서 준비되는 대로 저장)
- **새 탭 대신 같은 탭으로 이동**한다(`window.location.assign`).
- **오류를 구분한다.** `AbortError`(사용자가 닫음)는 조용히 넘어가고, `NotAllowedError` 는 "한 번 더 눌러 주세요", 그 외 실패는 카드를 대신 저장해 준다. 공유 창이 없는 브라우저(대부분의 PC)는 카드 저장 + 링크 복사. `alert` 대신 화면 안 안내 문구(`.share-notice`)로 보여 준다.
- **저장 해상도를 낮췄다.** 공유용은 1080 기준 1배(1080×1350). 저장 배율은 최대 2배(`CAPTURE_SCALE`). 같은 조건 측정값: 렌더 277ms + PNG 91ms = **0.37초**, 191KB.
- **사진을 끝내 못 불러와도 공유할 수 있게** 했다. 예전엔 `mediaLoadFailed` 면 버튼이 "이미지 반영 실패"로 영영 잠겼다. 이제 사진 없는 카드로 만들고 안내만 띄운다.

**확인한 방법**
- 로컬(프론트 5173 · 백엔드 8080, `local` 프로필)에서 실제 공유 데이터(`/attendance/share/<slug>?auto=share&from=attendance`)로 열어 버튼 상태 변화를 시간순으로 측정: `사진 불러오는 중...`(1.1s) → `카드 준비 중...`(1.5s) → `공유하기`(5.2s, 이후 대기 단축 700→400ms). 자동 공유 시도 없음, 안내 문구 정상.
- `tsc` 통과. `eslint` 문제 수: 원본 대비 감소(any 3→2, deps 2→1).
- **아직 못 한 것**: 실제 휴대폰(iOS 사파리·안드로이드 크롬)에서 공유 창이 뜨는지. 브라우저 패널에는 `navigator.share` 가 없어 재현 불가. 다음 배포 후 폰으로 확인 필요.

---

## 2026-10-11 · 출석 카드 미리보기와 저장 이미지의 크기가 다르다

**불편**
미리보기에서는 로고가 사진을 반 넘게 가리는데, 저장한 이미지에서는 로고·문구가 작게 나왔다. 미리보기와 결과물이 다른 카드였다.

**원인**
카드 위 요소 크기가 전부 고정 px 였다(로고 188~224px, 문구 34~38px, 라벨 24~28px). 미리보기 카드 폭은 기기마다 다르고(폰 311px, PC 566px), 저장할 때는 카드를 1080px 로 다시 그린다. 측정값:

| | 카드 폭 | 로고 / 카드 폭 | 문구 크기 / 카드 폭 |
|---|---|---|---|
| 폰 미리보기 | 311px | 0.60 | 0.11 |
| PC 미리보기 | 566px | 0.33 | 0.06 |
| 저장 이미지 | 1080px | 0.17 | 0.03 |

**고친 방법** — [attendanceShare.css](../frontend/src/styles/attendanceShare.css) 맨 아래 블록
- `.share-preview { container-type: inline-size }` 로 카드를 컨테이너로 만들고, 카드 안 모든 크기(로고, 스티커, 장식, 제목, 캐릭터 칩, 스토리 안전 영역, 본문, 배지, 문구, 메타)를 `cqw`(카드 폭의 1%)로 바꿨다. 기준 폭 560px 에서 보이던 크기를 비율로 옮겼다(로고는 카드 폭의 26%).
- px 로 그려지는 아바타(`size` prop)는 칸 크기에 맞춰 늘어나게 했다.

**확인한 방법**
- 폰 폭(375px 화면, 카드 311px)과 1080px 복제본에서 같은 요소를 측정: 로고 0.258 / 0.260, 문구 0.060 / 0.060. 미리보기 = 저장본.

---

## 2026-10-11 · 사진 필터(밝기·대비·따뜻함·블러)가 저장 이미지에 안 들어간다

**불편**
미리보기에서 사진 필터를 조절해도 저장·공유한 이미지는 원본 사진이었다.

**원인**
저장 경로인 `html2canvas` 는 CSS `filter` 를 그리지 않는다. 실험: 빨간 박스에 `filter: grayscale(1)` 을 걸고 캡처 → 결과 픽셀 `(255, 0, 0)` 그대로. 반면 실패 시 대체 경로(`utils/attendanceShareCard.ts`)는 캔버스 `ctx.filter` 로 필터를 넣고 있어서, 어느 경로로 저장되느냐에 따라 결과가 달랐다.

**고친 방법** — `bakeMediaFilter()` ([AttendanceShareView.tsx](../frontend/src/pages/AttendanceShareView.tsx))
- 캡처 직전에 사진을 캔버스에 필터와 함께 그려 새 이미지로 만들고(긴 변 최대 2160px, JPEG 0.92), 캡처용 복제본의 배경을 그 이미지로 바꿔 끼운 뒤 CSS filter 는 끈다. 캔버스 filter 를 지원하지 않는 옛 브라우저는 원본 그대로.
- 캡처할 때 화면의 미리보기에 `exporting` 클래스를 붙였다 떼던 동작을 없앴다(백그라운드 준비 중에 미리보기 애니메이션이 멈추는 것을 막기 위해). 복제본에만 붙인다.

**확인한 방법**
- 3072×912 사진 기준 필터 입히기 16~72ms. `tsc` 통과.
- **아직 못 한 것**: 저장된 파일을 열어 필터 적용을 눈으로 확인(브라우저 패널에서 파일 다운로드는 사용자 승인이 필요해서 생략).

---

## 2026-10-11 · 마이페이지가 "캐릭터 정보를 불러오는 중입니다"에서 멈춘다

**불편**
마이페이지에 들어가면 캐릭터를 불러온다는 문구만 계속 떴다.

**원인**
- 직접 원인: 로컬 백엔드(8080)와 실시간 서버(4001)가 꺼져 있었다. 프론트만 떠 있어 API 요청이 전부 실패.
- 숨은 문제: 마이페이지는 캐릭터가 없으면 로딩 실패든 아니든 "불러오는 중"만 보여 줬다. 실패해도 사용자는 알 수 없고 다시 시도할 방법도 없었다(원래부터 있던 동작).

**고친 방법** — [MyPage.tsx](../frontend/src/pages/MyPage.tsx)
- 불러오기를 `loadAll()` 로 묶어 처음 진입과 "다시 시도"가 같은 순서로 불러오게 했다.
- 서버가 꺼졌거나 네트워크가 끊긴 경우(`TypeError`/`Failed to fetch`)는 "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." + **다시 시도** 버튼.
- 캐릭터 영역은 불러오는 동안만 로딩 표시, 실패하면 "캐릭터 정보를 불러오지 못했어요." + 다시 시도.

**확인한 방법**
- `tsc` 통과, `eslint` 문제 수 원본과 같음.
- **아직 못 한 것**: 실패 화면을 실제로 띄워 보기(로그인 상태에서 백엔드를 꺼야 함).

---

## 2026-10-10 · 캐릭터가 디자인과 따로 논다 → 픽셀 리프터로 다시 그림

**불편**
캐릭터 카드에서 아바타 주변에 네모난 노란 안개가 끼고, "탈락위기" 배지가 얼굴을 가리고, 발이 플랫폼 속에 묻혔다. 그림체 자체도 새 디자인(짐 플로어)과 맞지 않았다.

**원인**
- 아바타 `<g>` 에 걸린 네온 글로우 `drop-shadow(0 0 최대 80px 안팎)` 와, SVG 영역(144×192)보다 큰 오라 링·스킬 배경 타원이 가장자리에서 잘리며 사각형 안개처럼 보였다.
- 티어별로 채도·밝기를 올리는 필터(MASTER 는 `saturate(1.7) brightness(1.2)`)가 색을 노랗게 날렸다.
- 위험 배지는 예전 네온 그라데이션 알약이고 머리 위치(`top:-10px`)에 겹쳤다.

**고친 방법**
- [pixelAvatar.ts](../frontend/src/components/avatar/pixelAvatar.ts) 새로 작성: 24×32 그리드에 리프터를 그리고 1px 검정 외곽선을 자동으로 두른다. 데이터 → 그림 규칙:
  - 근육 성장치 → 4단계 체형(어깨·팔·다리 두께), 체지방 → 허리
  - 진화 단계 → 자세: 1~2 서기, 3~5 양팔 알통, 6~8 바벨 오버헤드(원판 빨강→파랑→노랑 순으로 증가)
  - 티어 → 장비: 손목 랩 → 벨트 → 무릎 보호대 → 헤어밴드 → 금 버클·초크 손 → 챔피언 벨트 → 금 신발
  - 진화 갈래 → 민소매 색(TITAN 빨강, BLAZE 노랑, PHANTOM 파랑), 없으면 MBTI
  - 휴식 → 수건·감은 눈·Zz, 출석 위험 → 땀방울·처진 입, 스킬 → 초크 가루·충격파·가슴 마크·반짝임
- [AvatarRenderer.tsx](../frontend/src/components/avatar/AvatarRenderer.tsx) 는 props 를 그대로 두고 그리는 부분만 교체 → 아바타를 쓰는 모든 화면이 함께 바뀜.
- [avatar.css](../frontend/src/components/avatar/avatar.css): 티어 색 필터 제거, 배지를 v2 칩(탈락위기 빨강·경고 노랑·휴식 파랑)으로, 머리 위로 이동. 픽셀 효과 애니메이션 추가.
- [CharacterCard.tsx](../frontend/src/components/CharacterCard.tsx): 발이 플랫폼 윗면에 닿게, 종합 점수 게이지를 초록→노랑→빨강(높을수록 위험처럼 보임)에서 노랑 하나로.
- 확인용 개발 전용 페이지 `/dev/avatars` ([DevAvatars.tsx](../frontend/src/pages/DevAvatars.tsx), `import.meta.env.DEV` 일 때만 라우트).

**확인한 방법**
- `/dev/avatars` 에서 단계 1~8, 티어 8종, 근육 4단계, 성별, 휴식·경고·탈락위기, 갈래별 스킬 변형을 눈으로 확인. 배포 빌드에 갤러리가 포함되지 않음을 확인.
- **아직 못 한 것**: 로그인 상태의 마이페이지 캐릭터 카드 안에서의 모습. 예전 아바타 부품(`Arms`·`Head`·`Legs`·`Torso`·`Effects`.tsx)은 더 이상 쓰이지 않음 — 삭제 여부 결정 필요.

---

## 2026-10-09 ~ 10 · UI 전면 리디자인 "짐 플로어(v2)"

**불편(디자인 평가에서 나온 것)**
반투명 유리 카드·핑크→보라 그라데이션·네온 글로우의 흔한 AI 랜딩 스타일. 페이지마다 다른 레퍼런스를 쓴 것처럼 톤이 다름(코드에 서로 다른 hex 색 150개, 서체 6종). 한글이 단어 중간에서 줄바꿈, 넓은 자간의 작은 라벨 남용, 카드 안 카드 안 카드, 이모지 아이콘, 개발자용 문구(`/api/...`, `ROLE_ADMIN`) 노출, 핵심 기능(출석·라운지)이 메뉴에서 보이지 않음.

**고친 방법** (디자인 시안: claude.ai 아티팩트 "득근득근 게임 UI 시안" v2)
- 콘셉트: 헬스장 소재 — 고무 매트 바닥, 볼트 박힌 철판, 화이트보드, 메이플 플랫폼, 국제 규격 원판 색. 대표 요소는 "바벨이 곧 진행 바".
- 전역: [tailwind.config.js](../frontend/tailwind.config.js) 에서 색 계열을 다시 정의(회색→철판, 핑크·보라→원판 빨강, 시안·주황→원판 노랑, 초록→원판 초록, 파랑→원판 파랑)해서 40여 개 페이지가 클래스 수정 없이 한 번에 바뀌게 함. 모서리 각지게, 그림자는 블러 없는 오프셋, `backdrop-blur` 0. 서체 Black Han Sans(제목)·Big Shoulders(숫자)·IBM Plex Sans KR(본문)·Nanum Pen Script(화이트보드).
- [index.css](../frontend/src/index.css): 공통 부품 `.dg-steel` `.dg-well` `.dg-rubber` `.dg-whiteboard` `.dg-platform` `.dg-btn(-primary|-steel)` `.dg-chip`, 인터랙션 `.dg-rise` `.dg-pop` `.dg-lift` `.dg-plate-in` `.dg-loading-plates`, `word-break: keep-all`, 노란 포커스 외곽선, 움직임 줄이기 설정 존중.
- 장식용 블러 원(blur-3xl) 40개 삭제.
- 헤더·로고(25kg 원판), 홈(이번 주 운동 일수만큼 원판이 끼워지는 바벨, 화이트보드 할 일, 누르면 들어 올리는 바벨), 그 외 페이지는 화면별로 나눠 적용(출석·라운지·AI/인바디·커뮤니티 23개·마이페이지/관리자/공통 위젯).
- 공통 인터랙션 도구: `useCountUp`, `useInView`(callback ref 로 늦게 그려지는 요소도 관찰), `CountUp`, `Barbell`, 초크 가루(`lib/chalkBurst.ts`).

**확인한 방법**
- `npm run build` 통과, `tsc` 0 오류, 바꾼 파일들 `eslint` 문제 수가 원본보다 늘지 않음.
- 홈·소개·프로그램·로그인·403·공유 페이지를 데스크톱과 모바일(375px)에서 직접 확인, 가로 넘침 없음.

---

## 2026-10-10 · 로컬 백엔드가 "DataSource url 없음"으로 안 뜬다

**불편** `./gradlew bootRun` 이 `Failed to configure a DataSource` 로 실패.

**원인** PC 환경변수 `SPRING_PROFILES_ACTIVE=mysql` 이 걸려 있어 `application.properties` 의 기본값(`local`)을 덮어썼고, `mysql` 프로필 설정 파일은 없다.

**고친 방법** 실행할 때만 `SPRING_PROFILES_ACTIVE=local` 로 덮어쓴다. `.claude/launch.json` 의 `backend` 설정에 넣어 둠. (환경변수 자체는 다른 프로젝트에서 쓸 수 있어 건드리지 않음)

---

## 남은 문제 (발견했지만 아직 안 고침)

| 문제 | 위치 | 비고 |
|---|---|---|
| 이모지 `??` 손상(커밋 `2de4f34`)이 남아 있을 수 있음 — 출석 카드 · 자랑방은 고침 | `utils/attendanceShareCard.ts` | 확인 필요 |
| 출석 카드 워터마크가 예전 브랜드(핑크·보라) | `assets/images/워터마크.png` | "출석 도장" 디자인으로 교체 예정 |
| 카드 렌더러가 두 벌(DOM 캡처 + 캔버스 대체) | `AttendanceShareView.tsx`, `utils/attendanceShareCard.ts` | 하나로 합치는 것을 권장 |
| 공유 카드 캐릭터 칩의 `backdrop-filter` 가 저장본에 안 나옴 | `attendanceShare.css` | html2canvas 미지원 |
| 에이전트가 파일마다 복사한 부품(칸 게이지 3벌, 카운트업 7벌, 입력칸 상수) | 여러 페이지 | 공용 부품으로 정리 |
| README 스크린샷 6장이 예전 디자인 | `docs/screenshots/` | 다시 촬영 |
| 관리자 "일괄 처리 대기열"이 브라우저에서만 실행됨(서버 예약 아님) | `Admin.tsx` | 서버 스케줄러 필요 |
| 운영 DB 스키마를 `ddl-auto=update` 로 자동 변경 | `application-prod.properties` | Flyway 도입 계획: docs/fixes/2026-10-11-backend-data.md |
| 50개 넘는 공동구매 · 후기 목록의 페이지 넘김 | `Protein.tsx`, `Reviews.tsx` | 서버는 50개로 제한됨 |
| 홈 지도로 바뀌며 안 쓰게 된 "이번 주 바벨" 스타일(`.hero-stage*`), 모바일 히어로 캐릭터 카드 스타일 | `styles/homeLobby.css` | 지워도 되는지 확인 후 정리 |

---

## 기록 양식

```markdown
## YYYY-MM-DD · 한 줄 제목 (사용자가 겪은 증상으로)

**불편** 사용자가 실제로 겪은 것. 화면 문구가 있으면 그대로.

**원인** 왜 그랬는지. 추측이 아니라 근거(코드 위치, 측정값, 실험 결과).

**고친 방법** 무엇을 어떻게 바꿨는지와 파일 링크. 왜 그 방법을 골랐는지.

**확인한 방법** 어떻게 검증했는지(명령, 측정값, 확인한 화면).
**아직 못 한 것** 확인하지 못한 부분은 숨기지 말고 적는다.
```
