# 2026-10-11 · 0단계 PR 5 — 계정 연결 구조(social_accounts) · 카카오 로그인 준비

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §3.

## 왜
- 계정을 **Google 이메일로만** 찾았다(`AuthController.googleLogin` 의 `findByEmail`). 카카오는 이메일을 주지 않을 수 있어 붙일 방법이 없었다.
- 카카오 로그인은 사업자 없이도 기본(닉네임 · 프로필)은 쓸 수 있고, 이메일은 "개인 개발자 비즈 앱" 전환 후 동의 항목을 켜야 온다 → 이메일 없이도 가입되게 만든다.

## 고친 코드 (백엔드)
- 새 `entity/SocialProvider`(GOOGLE · KAKAO), `entity/SocialAccount` — 테이블 `social_accounts(user_id, provider, provider_user_id, email_at_link)`, unique(provider, provider_user_id).
- `entity/User.java`: `email_placeholder`(null = 실제 이메일), `hasRealEmail()`.
- 새 `service/SocialLoginService.resolveUser(profile)`:
  1. (공급자, 회원 번호)로 연결된 사람 → 그 사람
  2. 공급자가 **인증한** 이메일의 기존 사용자 → 연결(예전 Google 가입자는 다음 로그인 때 자동 이전)
  3. 새로 가입 — 인증된 새 이메일이면 그대로, 아니면 `kakao-{번호}@users.musclehub.invalid` + `emailPlaceholder=true`
  - **인증 안 된 이메일로는 기존 계정에 붙지 않는다**(남의 계정 가로채기 방지). 설계 문서의 "자동 합치기 안 함"을 "인증된 이메일만 연결"로 구체화.
- 새 `service/KakaoOAuthClient` — 인가 코드 → 토큰 → `/v2/user/me`(RestClient). 이메일은 `is_email_valid && is_email_verified` 일 때만 인증된 이메일로 본다.
  키가 없으면 503 "준비 중", 돌아올 주소가 허용 목록에 없으면 400. 카카오 응답 본문(토큰)은 로그에 남기지 않는다.
- `controller/AuthController.java`: Google 은 `payload.getSubject()` 로 `resolveUser`, 새 `POST /api/auth/kakao {code, redirectUri, rememberMe}`(IP 당 5분 30번), 로그인 응답 만들기를 `loginResponse()` 로 묶음.
- `application.properties`: `kakao.rest-api-key=${KAKAO_REST_API_KEY:}` · `kakao.client-secret=${KAKAO_CLIENT_SECRET:}` · `kakao.redirect-uris=${KAKAO_REDIRECT_URIS:}`.
- 새 칸 · 테이블은 Hibernate 가 만든다(데이터 이전 SQL 없음 — 예전 가입자의 연결은 로그인할 때 생긴다).

## 고친 코드 (프론트)
- `pages/Login.tsx`: `VITE_KAKAO_REST_KEY` 가 있을 때만 "카카오로 시작하기"(카카오 규격 #FEE500) — 카카오톡 안 브라우저에선 보이고 다른 앱 안 브라우저에선 숨김.
  카카오 창 → `/login?code&state` 로 돌아오면 **state 확인**(내가 보낸 값과 다르면 거절) 후 서버로 code 전달, 주소에서 code 를 지움. 제목은 키가 있으면 "로그인".
- 새 `lib/displayEmail.ts`: 내부용 주소는 화면에 이메일로 보이지 않게 — `MyPage.tsx`(이름 옆), `CrewChallenge.tsx`(가입 신청 목록).

## 확인
- 백엔드 테스트 28개 — 로컬 MySQL · 임시 Postgres 둘 다 통과. 새 `SocialLoginServiceTest` 5개(예전 Google 가입자 연결 → sub 로 다시 찾기, 이메일 없는 카카오 = 내부용 주소, **인증 안 된 이메일로 남의 계정 못 붙음**, 인증된 카카오 이메일 연결, 새 사용자 실제 이메일), `KakaoOAuthClientTest` 3개(응답 해석 · 인증 안 된 이메일 · 설정 없음 503 · 허용 안 된 주소 400).
- 로컬 서버: `POST /api/auth/kakao` → 503 "카카오 로그인은 아직 준비 중이에요."
- 화면(개발 서버에 **가짜 시험 키**를 잠깐 넣고): 버튼 보임(#FEE500), 누르면 카카오 로그인 창(`accounts.kakao.com`)으로 이동, 위조된 state → "확인하지 못했어요", 맞는 state → 서버 503 문구, 주소에서 code 제거, 375px 확인. 키를 지우면 버튼 숨김 · 제목 "Google 로그인"(지금 운영과 같음).
- `verify.sh` 통과(린트 증가 없음).

## 사용자가 할 일 (카카오 켜기)
1. [카카오 디벨로퍼스](https://developers.kakao.com) → 내 애플리케이션 → 앱 만들기.
2. 플랫폼 > Web: 사이트 도메인 `https://musclehub.co.kr` (+ 개발용 `http://localhost:5173`).
3. 카카오 로그인 > 활성화 ON, Redirect URI: `https://musclehub.co.kr/login` (+ `http://localhost:5173/login`).
4. 동의 항목: 닉네임(필수). 이메일은 "개인 개발자 비즈 앱" 전환 후 선택 동의로(안 해도 가입은 됨).
5. (선택) 보안 > Client Secret 켜기.
6. Railway 백엔드: `KAKAO_REST_API_KEY` · `KAKAO_REDIRECT_URIS=https://musclehub.co.kr/login` · (켰다면) `KAKAO_CLIENT_SECRET`.
7. Vercel: `VITE_KAKAO_REST_KEY`(같은 REST API 키) → 재배포.

## 남은 것
- 실제 카카오 계정으로 로그인 끝까지(키 등록 후).
- 마이페이지 "계정 연결"(로그인한 상태에서 다른 공급자 추가) · 로그인 주체를 이메일 → 사용자 id 로 바꾸기(설계 §3, 나중).
- 새 가입자의 닉네임이 Google 실명 · 카카오 닉네임 그대로 — 닉네임 설정 화면(로드맵 3장).
