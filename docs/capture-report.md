# 득근득근 화면 캡처 및 문서화 보고서

## 1. 실행한 명령어 요약

문서 작성을 위해 다음 범주의 명령을 실행했습니다.

| 구분 | 실행 내용 |
|---|---|
| 작업 전 상태 확인 | `git status --short`로 기존 변경사항 여부를 확인했습니다. 초기 작업 상태는 깨끗했습니다. |
| 프론트엔드 의존성 | `frontend` 폴더에서 `npm ci`를 실행했습니다. |
| 실시간 서버 의존성 | `realtime` 폴더에서 `npm ci`를 시도했으나 기존 `node_modules` 잠금 문제로 실패했고, 이후 `npm install`로 실행 가능 상태를 복구했습니다. |
| 백엔드 실행 | Spring Boot 백엔드를 테스트 프로필로 실행하고 `/api/ping` 응답을 확인했습니다. |
| 프론트엔드 실행 | Vite 개발 서버를 실행하고 `http://127.0.0.1:5173` 접속을 확인했습니다. |
| 실시간 서버 실행 | Socket.IO 기반 실시간 서버를 실행하고 `/status` 응답을 확인했습니다. |
| 브라우저 캡처 준비 | Playwright Chromium 브라우저를 설치했습니다. |
| 화면 캡처 | `node docs/scripts/capture-screenshots.mjs`로 주요 화면을 캡처했습니다. |
| HTML/PDF 생성 | `node docs/scripts/render-docs.mjs`로 Markdown 문서를 HTML과 PDF로 변환했습니다. |

## 2. 실행 성공 여부

| 항목 | 결과 |
|---|---|
| 백엔드 API | 성공. `/api/ping`에서 `pong` 응답을 확인했습니다. |
| 프론트엔드 | 성공. Vite 개발 서버에서 화면 접근과 라우팅을 확인했습니다. |
| 실시간 서버 | 성공. 상태 확인 API에서 라운지 상태 응답을 확인했습니다. |
| DB 연동 | 성공. 로컬 테스트 DB를 사용해 로그인, 더미 데이터 생성, 관리자 화면 접근을 확인했습니다. |
| 화면 캡처 | 성공. 방문자, 일반 회원, 관리자 화면을 캡처했습니다. |
| HTML/PDF 생성 | 성공. `service-introduction.html`, `user-guide.html`, `service-introduction.pdf`, `user-guide.pdf` 산출물 파일을 확인했습니다. |

## 3. 사용한 캡처 도구

- 도구: Playwright Chromium
- 브라우저 크기: 1440 x 900
- 이미지 형식: PNG
- 저장 위치: `docs/images/`
- 개인정보 보호 처리: 캡처 전 브라우저 DOM에서 이메일 형식 텍스트를 `테스트 계정`으로 마스킹했습니다.

## 4. 캡처한 화면 목록

| 파일 | 화면 |
|---|---|
| `home.png` | 비로그인 홈 화면 |
| `login.png` | 로그인 화면 |
| `signup.png` | 회원가입 화면 |
| `programs.png` | 프로그램 목록 화면 |
| `member-home.png` | 로그인 후 회원 홈 화면 |
| `attendance.png` | 출석 체크 화면 |
| `mypage.png` | 마이페이지 및 캐릭터/통계 화면 |
| `rankings.png` | 랭킹 화면 |
| `ai-fitness.png` | AI 맞춤 운동 플래너 화면 |
| `inbody-consult.png` | AI 인바디 상담 화면 |
| `brag-list.png` | 운동 자랑 게시글 목록 화면 |
| `brag-write.png` | 운동 자랑 작성 화면 |
| `protein-list.png` | 단백질 공동구매 화면 |
| `reviews.png` | 공동구매 리뷰 화면 |
| `crew-hub.png` | 크루/챌린지 화면 |
| `friends.png` | 친구 화면 |
| `lounge.png` | 실시간 라운지 화면 |
| `events.png` | 이벤트 화면 |
| `admin-dashboard.png` | 관리자 대시보드 화면 |
| `admin-events.png` | 관리자 이벤트 관리 화면 |
| `admin-history.png` | 관리자 히스토리 및 감사 로그 화면 |

## 5. 접근한 URL 목록

| URL | 용도 |
|---|---|
| `http://127.0.0.1:5173/` | 홈 및 회원 홈 화면 |
| `http://127.0.0.1:5173/login` | 로그인 |
| `http://127.0.0.1:5173/register` | 회원가입 |
| `http://127.0.0.1:5173/programs` | 프로그램 목록 |
| `http://127.0.0.1:5173/attendance` | 출석 체크 |
| `http://127.0.0.1:5173/mypage` | 마이페이지 |
| `http://127.0.0.1:5173/rankings` | 랭킹 |
| `http://127.0.0.1:5173/ai` | AI 맞춤 운동 플래너 |
| `http://127.0.0.1:5173/ai/inbody` | AI 인바디 상담 |
| `http://127.0.0.1:5173/brag` | 운동 자랑 목록 |
| `http://127.0.0.1:5173/brag/write` | 운동 자랑 작성 |
| `http://127.0.0.1:5173/protein` | 단백질 공동구매 |
| `http://127.0.0.1:5173/reviews` | 공동구매 리뷰 |
| `http://127.0.0.1:5173/crew` | 크루/챌린지 |
| `http://127.0.0.1:5173/friends` | 친구 |
| `http://127.0.0.1:5173/lounge` | 실시간 라운지 |
| `http://127.0.0.1:5173/events` | 이벤트 |
| `http://127.0.0.1:5173/admin` | 관리자 대시보드 |
| `http://127.0.0.1:5173/admin/events` | 관리자 이벤트 관리 |
| `http://127.0.0.1:5173/admin/history` | 관리자 히스토리 및 감사 로그 |

## 6. 사용한 테스트 계정 유형

| 계정 유형 | 용도 | 문서 노출 여부 |
|---|---|---|
| 테스트용 일반 회원 계정 | 회원 전용 화면 캡처, 출석/마이페이지/게시글/공동구매/크루/친구 화면 확인 | 계정 식별 정보와 비밀번호는 문서에 노출하지 않았습니다. |
| 테스트용 관리자 계정 | 관리자 대시보드, 이벤트 관리, 히스토리 화면 확인 | 계정 식별 정보와 비밀번호는 문서에 노출하지 않았습니다. |

## 7. 역할별 캡처 여부

| 역할 | 캡처 여부 | 비고 |
|---|---|---|
| 비로그인 방문자 | 완료 | 홈, 로그인, 회원가입, 공개 프로그램 화면을 캡처했습니다. |
| 일반 회원 | 완료 | 출석, 마이페이지, 랭킹, AI, 게시글, 공동구매, 크루, 친구, 라운지, 이벤트 화면을 캡처했습니다. |
| 관리자 | 완료 | 관리자 대시보드, 이벤트 관리, 히스토리 화면을 캡처했습니다. |
| 트레이너/코치 | 해당 없음 | 코드와 라우트에서 별도 트레이너/코치 역할과 전용 화면을 확인하지 못했습니다. |
| 운영자/스태프 | 해당 없음 | 관리자 외 별도 운영자/스태프 역할과 전용 화면을 확인하지 못했습니다. |

## 8. 실패한 캡처와 제한사항

- 캡처 자체는 모두 완료했습니다.
- 로컬 환경에 Google Client ID가 설정되어 있지 않아 로그인 화면에는 Google 로그인 설정 안내 문구가 표시됩니다. 이는 실제 배포 환경의 OAuth 설정 여부에 따라 달라질 수 있습니다.
- AI 기능은 OpenAI 연동 설정이 필요한 구조입니다. 캡처와 문서에는 실제 API Key나 응답 원문을 노출하지 않았고, 화면 구성과 사용 흐름 중심으로 설명했습니다.
- 단백질 공동구매 화면은 결제 기능이 아니라 모집, 신청, 채팅, 리뷰 중심으로 문서화했습니다.

## 9. 실제 구현되지 않아 제외한 기능

다음 기능은 코드와 라우트에서 전용 화면 또는 완성된 흐름을 확인하지 못해 구현 기능처럼 문서화하지 않았습니다.

- 트레이너/코치 전용 회원 관리 화면
- 운영자/스태프 전용 화면
- 전통적인 운동 종목 목록/운동 상세 화면
- 운동 루틴 생성/수정/삭제 전용 CRUD 화면
- 세트, 중량, 횟수 기반 운동 기록 등록 화면
- 식단 기록 또는 영양소 추적 화면
- 결제/주문 확정/환불 관리 화면
- 관리자 사용자 계정 직접 관리 화면

## 10. 문서 작성 시 참고한 주요 코드/파일 경로

| 경로 | 확인 내용 |
|---|---|
| `README.md` | 프로젝트 설명, 실행 방식, 전체 구조 |
| `frontend/package.json` | 프론트엔드 기술 스택 |
| `frontend/src/App.tsx` | 실제 라우트와 화면 구성 |
| `frontend/src/layouts/Header.tsx` | 주요 메뉴와 권한별 헤더 노출 |
| `frontend/src/components/ProtectedRoute.tsx` | 로그인 보호 라우트 구조 |
| `frontend/src/components/AdminRoute.tsx` | 관리자 권한 라우트 구조 |
| `frontend/src/pages/` | 홈, 로그인, 회원가입, 출석, 마이페이지, AI, 게시글, 공동구매, 크루, 친구, 라운지, 이벤트, 관리자 화면 |
| `frontend/src/services/` | 프론트엔드 API 호출 구조 |
| `backend/build.gradle` | 백엔드 기술 스택 |
| `backend/src/main/resources/application.yml` | 백엔드 실행 설정 구조 |
| `backend/src/main/java/com/muscleup/config/SecurityConfig.java` | Spring Security와 인증/인가 설정 |
| `backend/src/main/java/com/muscleup/controller/` | 주요 API 엔드포인트 |
| `backend/src/main/java/com/muscleup/entity/` | 주요 DB 엔티티 |
| `backend/src/main/resources/db/migration/` | DB 마이그레이션 구조 |
| `realtime/package.json` | 실시간 서버 기술 스택 |
| `realtime/src/server.ts` | Socket.IO 라운지 서버 구현 |

## 11. 민감정보 노출 여부 검토 결과

- 문서에는 테스트 계정 이메일, 비밀번호, 토큰, DB 비밀번호, API Key, 내부 키를 적지 않았습니다.
- 캡처 이미지에는 이메일 형식 텍스트가 보이지 않도록 마스킹했습니다.
- 관리자 계정의 실제 로그인 정보는 문서와 이미지에 포함하지 않았습니다.
- API 응답 원문, 인증 토큰, 로컬 환경변수 값은 문서화 대상에서 제외했습니다.
