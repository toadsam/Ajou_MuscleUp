# 2026-10-11 · 0단계 PR 6-1 — 서비스 이름 "득근득근" 통일 · 모임 찾기 / 짐 페이지 · 초대 링크 규칙

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §7 · §7-1. 사용자 결정: 서비스 이름 = **득근득근**.
6번 PR 을 둘로 나눴다 — 6-1(이것) 이름 · 짐 화면, 6-2 소식 · 이벤트 · 자랑방을 짐별로.

## 1. 이름 · 소개 문구
| 곳 | 전 | 후 |
|---|---|---|
| `frontend/index.html` 제목 · 설명 · OG · 트위터 | "득근 - 운동 커뮤니티", "프로틴 공동구매, 클래스 후기, 회원 소개" | "득근득근 - 출석하면 캐릭터가 자라는 헬스장", "운동한 날 출석하면 내 픽셀 캐릭터가 자라요. 동아리 · 운동 모임과 함께…" |
| `layouts/Logo.tsx` · `Footer.tsx` | 득근 · "운동을 사랑하는 사람들의 모임" | 득근득근 · "출석하면 캐릭터가 자라는 헬스장" |
| `vite.config.ts` 앱 이름 · 설명 | "득근득근 MuscleUp" · "게임형 피트니스 커뮤니티 앱" | "득근득근" · "출석하면 캐릭터가 자라는 헬스장" |
| `pages/About.tsx` | "Ajou MuscleUp", "아주대 헬스 동아리의 커뮤니티예요" | "득근득근", "아주대 헬스 동아리에서 시작한 운동 커뮤니티예요. 이제 어느 동아리 · 운동 모임이든 함께할 수 있어요" |
| `AttendanceSharePageController.java` 공유 미리보기 | "…'s Attendance Brag - MuscleUp", "Workout completed today on MuscleUp.", site_name MuscleUp, "Open shared attendance page" | "○○님의 오늘 출석 \| 득근득근", "오늘 운동 완료 · 득근득근", site_name 득근득근, "출석 카드 보러 가기" |
| `EmailVerificationService.java` 메일 제목 | [Ajou MuscleUp] | [득근득근] |
| `Events.tsx` | 동아리 소식 | 소식 |
| `BragWrite.tsx` · `WriteProtein.tsx` 예시 | AJOU GYM · 아주대 헬스장 | 학교 체육관 |
| `SupportWidget.tsx` | 득근득근 회장에게 · 회장님께 | 득근득근 운영진에게 · 운영진에게 |

아주대 동아리 고유 화면(동아리 소개 · 운영진 · 회원 명단 · 갤러리)은 그대로 두고, 아주대 짐 페이지에서 링크로 묶었다.

## 2. 가입 규칙 (백엔드)
- `CrewServiceImpl.join(id)`: 번호로 가입은 **운영 중 + 비공개 아님**만(그 외 403 "초대 링크로만 들어갈 수 있는 모임이에요.").
- `joinByInviteCode`: 보관된 모임만 막음.
- `GymService.visibleGymOrThrow(slug, me, inviteCode)` · `GET /api/gyms/{slug}?code=` · `/members?code=`: 맞는 초대 코드면 비공개 · 승인 대기 모임도 보임(초대 코드 값 자체는 여전히 멤버에게만).

## 3. 화면 (새)
- `types/gym.ts` — 짐 타입 · 한국어 이름표(종류 · 역할 · 공개 범위 · 상태 · 가입 방식) · 주소 규칙.
- `pages/Gyms.tsx` `/gyms` "모임 찾기": 내 모임 · 찾기(이름 · 종류) · 모임 만들기(주소 미리보기 · 규칙 검사, 승인 대기 안내) · 운영자 승인 대기 목록.
- `pages/GymPage.tsx` `/g/:slug`: 소개 · 상태 · 가입(로그인 / 바로 가입 / 가입 신청 / 초대 코드) · 초대 링크 복사 · 나가기 · 멤버(모임장은 운영진 지정) · 가입 신청 승인 · 설정(모임장) · 아주대 짐이면 동아리 페이지 링크.
- `App.tsx` 라우트(로그인 없이 열림), `Header.tsx` "커뮤니티 > 모임 찾기".
- 검토 중 고침: 가입 신청 결과값을 `REQUESTED` 로 기다렸는데 서버는 `PENDING` 을 돌려줌(`CrewServiceImpl.joinWithPolicy`) → `PENDING` 으로.

## 확인
- 백엔드 테스트 29개 통과(새: 승인 대기 짐 — 번호 가입 403 · 주소만 404 · 틀린 코드 404 · 맞는 코드 보임 · 코드로 가입).
- `verify.sh` 통과(타입 0, 바뀐 파일 린트 증가 없음, 빌드).
- 브라우저(로그아웃): 375px · 데스크톱 — 로고 "득근득근" 헤더에 맞음, `/gyms` 찾기 결과, `/g/ajou-muscleup` 소개 · "로그인하고 가입하기" · 동아리 링크 4개 · 모임장 목록, 없는 주소 안내, 가로 넘침 없음. 탭 제목 새 이름.

## 못 한 것
- 로그인이 필요한 흐름(내 모임 · 만들기 · 가입 · 초대 코드 가입 · 나가기 · 역할 변경 · 신청 승인 · 설정 · 운영자 승인)은 화면으로 못 봄 — 로컬 Google 로그인 후 같이 확인.
- 헤더 "짐 전환"(지금 보는 모임 고르기)과 소식 · 이벤트 · 자랑방 짐별 나누기는 6-2.
