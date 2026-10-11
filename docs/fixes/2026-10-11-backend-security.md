# 2026-10-11 백엔드 보안 — 로그인·권한·업로드·요청 제한·CORS·예외 처리

전체 점검에서 나온 백엔드 보안 항목을 고친 기록. 항목 번호는 점검 목록 번호 그대로다.
패키지 루트 `B` = `backend/src/main/java/com/ajou/muscleup/`.

## 새로 만든 공용 부품

- `B/security/RateLimiter.java` — 메모리 고정 창(fixed window) 요청 제한기. 외부 의존성 없음.
  - `check(key, limit, window, message)`: 1회 쓰고 한도를 넘으면 `429 TOO_MANY_REQUESTS` + 한국어 문장.
  - `isBlocked / recordFailure / reset`: "실패할 때만 센다"(로그인 실패 횟수)용.
  - `@Scheduled(fixedDelay = 5분)` 으로 만료된 키 정리.
  - 한계: 서버 한 대 기준. 여러 대로 늘리면 Redis 같은 공유 저장소로 옮겨야 한다.
- `B/security/UploadFileTypes.java` — 업로드 파일 앞부분 바이트(매직 넘버)로 형식을 판별.
  허용: jpg·png·webp·gif·heic(사진), mp4·mov·webm(영상). 판별 결과로 저장 확장자·Content-Type 을 정한다.
- `B/util/RoleUtils.java` — `isAdminRole("ROLE_ADMIN" | "ADMIN")`, `isAdmin(User)`, `isAdmin(Authentication)`.
- `backend/src/test/java/com/ajou/muscleup/service/RefreshTokenServiceTest.java` — 리프레시 토큰 회전 테스트 5개.

---

### 4. 아무 파일이나 올라가고, 올린 파일이 그대로 웹페이지로 열림

- **문제**: `/api/files/upload` 에 HTML·SVG·스크립트를 `.jpg` 등 아무 이름으로 올릴 수 있었고, `/uploads/**` 는 로그인 없이 공개라
  링크를 열면 우리 도메인에서 그 파일이 실행될 수 있었다(저장형 XSS · 피싱 페이지 호스팅).
- **원인**: `FileController.upload` 가 원래 파일 이름의 확장자를 그대로 붙여 저장(`:79-83`), 형식 검사 없음.
  S3 모드는 클라이언트가 보낸 Content-Type 을 그대로 저장(`:93`). `/uploads/**` 는 `SecurityConfig:84` 에서 permitAll,
  `WebMvcStaticConfig` 가 디스크에서 그대로 서빙.
- **고친 코드**
  - `B/controller/FileController.java` — `upload`: 앞부분 32바이트로 형식 판별, 허용 목록 밖이면 415. 확장자·Content-Type 은 판별 결과로.
    S3 저장 시 사진이 아니면 `Content-Disposition: attachment`.
    ```diff
    - String ext = ""; int dot = original.lastIndexOf('.'); if (dot >= 0) ext = original.substring(dot);
    - String filename = UUID.randomUUID() + ext;
    + UploadFileTypes.Detected detected = detectType(file);
    + if (detected == null) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    +         "사진(JPG·PNG·WEBP·GIF·HEIC)이나 영상(MP4·MOV·WEBM)만 올릴 수 있어요.");
    + String filename = UUID.randomUUID() + "." + detected.extension();
    ...
    - .contentType(file.getContentType() == null ? "application/octet-stream" : file.getContentType())
    + .contentType(detected.contentType());
    + if (!detected.isImage()) put.contentDisposition("attachment");
    ```
  - `B/controller/FileController.java` — `proxy`: 응답을 새 `proxyResponse(...)` 로 모아 `X-Content-Type-Options: nosniff`,
    사진이 아니면 `Content-Disposition: attachment`.
  - `B/config/WebMvcStaticConfig.java` — `addInterceptors` 추가. `/uploads/**` 응답에
    ```diff
    + response.setHeader("X-Content-Type-Options", "nosniff");
    + response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
    + if (!UploadFileTypes.isImagePath(request.getRequestURI())) response.setHeader("Content-Disposition", "attachment");
    ```
    CSP `sandbox` 는 예전에 이미 올라간 HTML/SVG 가 직접 열려도 스크립트가 돌지 않게 한다. `<img>`·`<video>` 표시는 영향 없음.
- **확인**: 별도 포트(8091)로 새 코드를 띄우고 curl(테스트용 액세스 토큰, 존재하지 않는 테스트 이메일로 발급).
  - HTML 내용을 `evil.jpg` 로 올림 → **415** + 한국어 문장.
  - PNG 바이트를 `ok.html` 이름으로 올림 → 200, 저장 이름은 `<uuid>.png` (응답 `name` 은 원래 이름 그대로). 확인 후 운영진 토큰으로 삭제(204).
  - 기존 `/uploads/...webp` → `nosniff` + CSP 헤더 확인. 기존 `.avif` 파일 → `Content-Disposition: attachment` 추가 확인.
  - `UploadFileTypes.detect` 를 jpg/png/mov/mp4/heic 샘플 바이트로 직접 돌려 판별 확인. 기존 업로드 중 `.webp` 이름의 파일이 실제로는 GIF 인 것도 바르게 판별.
- **남은 것**: 이미 저장된 옛 파일의 확장자는 그대로다(서빙 헤더로만 막음). HEIC 는 브라우저 대부분이 `<img>` 로 못 보여 준다(변환은 범위 밖).
  `.avif` 는 업로드 허용 목록에 없다(필요하면 `UploadFileTypes` 에 추가).

### 5. AI 비용 남용(로그인 없이 AI 챗봇 무제한 · AI 엔드포인트 길이·횟수 제한 없음)

- **문제**: 누구나 `/api/support/chat` 을 무한 호출해 OpenAI 비용을 태울 수 있었다. 로그인 회원도 `/api/ai/*` 를 횟수·길이 제한 없이 호출 가능.
- **원인**: `SecurityConfig:71` `/api/support/**` permitAll, `SupportController.chat` → `SupportChatService.answer` → `aiService.requestCompletion`.
  `AiController` 의 `analyze/plan/chat/inbody/*` 에 `@Valid`·`@Size`·속도 제한 없음.
- **고친 코드**
  - `B/controller/SupportController.java` — `chat`: IP 당 분당 10회, IP 당 하루 200회, 로그인했으면 사람 당 분당 10회.
    ```diff
    - public ResponseEntity<SupportChatResponse> chat(@Valid @RequestBody SupportChatRequest req) {
    + public ResponseEntity<SupportChatResponse> chat(@Valid @RequestBody SupportChatRequest req,
    +                                                @AuthenticationPrincipal String email, HttpServletRequest request) {
    +     rateLimiter.check("support-chat-ip:" + request.getRemoteAddr(), 10, Duration.ofMinutes(1), "질문이 너무 빨라요. ...");
    +     rateLimiter.check("support-chat-ip-day:" + request.getRemoteAddr(), 200, Duration.ofDays(1), "오늘 안내 챗봇 사용 한도를 넘었어요. ...");
    +     if (isLoggedIn(email)) rateLimiter.check("support-chat-user:" + email, 10, Duration.ofMinutes(1), ...);
    ```
    `isLoggedIn` 은 permitAll 경로에서 비로그인 principal 이 `"anonymousUser"` 문자열로 들어오는 것을 걸러 낸다
    (안 거르면 모든 비로그인 사용자가 한 버킷을 나눠 써서 서로 막힌다).
  - `B/controller/AiController.java` — 새 `checkAiQuota(email)`: 사람 당 **분당 5회**, **하루(한국 날짜) 50회**.
    `analyze`, `buildPlan`, `chat`, `consultInbody`, `reviewConsult` 에서 호출. 한도는 `app.ai.rate.per-minute`, `app.ai.rate.per-day` 로 조정.
    `buildInbodyPdf` 는 AI 호출이 없지만 렌더링이 무거워 분당 5회.
    모든 `@RequestBody` 에 `@Valid`. `chat` 은 화면이 대화 기록 전체를 `context` 로 보내므로 받기는 2만 자까지, 프롬프트에는 뒤쪽 6천 자만(`tail`).
    `consultInbody` 의 멀티파트 문자열(goal/notes/goalIntensity/gender)은 길이를 직접 검사해 400.
    ```diff
    - public ResponseEntity<AiChatResponse> chat(@AuthenticationPrincipal String email, @RequestBody AiChatRequest req) {
    + public ResponseEntity<AiChatResponse> chat(@AuthenticationPrincipal String email, @Valid @RequestBody AiChatRequest req) {
    +     checkAiQuota(userEmail);
    +     String context = tail(req.getContext(), MAX_CHAT_CONTEXT_CHARS);
    ```
  - `B/dto/ai/AiChatRequest.java`(question `@NotBlank @Size(max=2000)`, context `@Size(max=20000)`),
    `AiAnalyzeRequest.java`(수치 20자, goal 500자), `AiPlanRequest.java`(100~1000자), `AiInbodyReviewRequest.java`(metrics 60개, age 1~120, heightCm 50~250),
    `AiInbodyPdfRequest.java`(consultation 2만 자, 맵 60개, 체크포인트 26개, 경고 50개).
- **확인**: 8091 인스턴스에서 `/api/support/chat` 을 같은 IP 로 11번 → 10번 200, 11번째 **429**
  (AI 를 부르지 않도록 문서와 안 맞는 질문으로 시험). `/api/ai/chat` 에 빈 question → 400 `question 공백일 수 없습니다`.
- **남은 것**: `/api/ai/*` 분당·하루 한도는 실제 OpenAI 비용이 들어 라이브로 6회 호출해 보지는 않았다(같은 `RateLimiter.check` 경로를 support chat·로그인에서 확인).
  한도 숫자(분당 5, 하루 50, 챗봇 IP 하루 200)는 운영하며 조정할 값이다.

### 8. 리프레시 토큰이 응답 본문·localStorage 에 노출되고, 회전·만료 검사가 없음

- **문제**: XSS 한 번이면 localStorage 의 리프레시 토큰(90일)을 훔쳐 계속 로그인할 수 있었다. 갱신해도 같은 토큰이 계속 쓰였고,
  DB 만료 시각을 보지 않았고, 행이 계속 쌓였다.
- **원인**: `AuthController.login/googleLogin`(`:92-98`, `:199-205`)이 `refreshToken` 을 본문에 실어 보냄 →
  `frontend/src/lib/installFetchAuth.ts:21-34`, `lib/api.ts:25-39` 가 `localStorage.user.refreshToken` 에 저장하고 `Authorization: Bearer` 로 갱신 요청.
  `RefreshTokenService.rotate` 는 `return current.getToken();`(같은 토큰), `expiresAt` 미검사, 정리 작업 없음.
- **고친 코드**
  - `B/service/RefreshTokenService.java` (전면 수정)
    - 토큰을 JWT 대신 **256비트 무작위 문자열**로 발급, DB `token` 컬럼에는 **SHA-256 해시**만 저장.
    - `rotate(raw)` → `Rotation(token, email, role)` 반환:
      1. 해시로 찾고, 없으면 옛 방식(원문 JWT 저장) 행을 원문으로 한 번 더 찾는다(기존 로그인 유지 — 첫 갱신 때 해시 행으로 바뀜).
      2. `expiresAt` 이 지났으면 행 삭제 + 401.
      3. 정상: 새 토큰 발급, 이전 행 `revokedAt=now`, `replacedBy=새 해시`.
      4. 이미 폐기된 토큰이 **30초(GRACE_SECONDS) 안에** 다시 오면(여러 탭 동시 갱신) 메모리 캐시에서 방금 만든 새 토큰을 그대로 준다.
      5. 30초가 지난 폐기 토큰이 오면 **재사용(탈취)으로 보고 그 사용자의 리프레시 토큰을 모두 삭제** + 401.
    - `revokeByToken(raw)`: 로그아웃용. 토큰을 해석하지 않고 해시로만 찾아 그 사용자 토큰 전부 삭제. 이상한 토큰이어도 예외 없음.
    - `purgeStale()` `@Scheduled(cron="0 30 4 * * *")`: 만료된 행 + 폐기된 지 7일 지난 행 삭제.
    ```diff
    - // Keep refresh token stable to prevent race-condition logouts ...
    - return current.getToken();
    + String newRaw = newRawToken();
    + String newHash = save(user, newRaw);
    + current.setRevokedAt(now);
    + current.setReplacedBy(newHash);
    + graceCache.put(hash, new GraceEntry(newRaw, now));
    + return Rotation.of(newRaw, user);
    ```
  - `B/entity/RefreshToken.java` — 컬럼 추가 `revoked_at`(nullable), `replaced_by`(varchar 128, nullable). `ddl-auto=update` 로 자동 추가된다.
  - `B/repository/RefreshTokenRepository.java` — `deleteStale(now, revokedBefore)` (`@Modifying @Query`).
  - `B/controller/AuthController.java`
    ```diff
    - .body(new LoginResponse(response.getToken(), ..., refreshToken));
    + // 리프레시 토큰은 httpOnly 쿠키로만 준다(본문의 refreshToken 은 항상 null).
    + .body(response);
    ...
    - if (refreshToken == null || refreshToken.isBlank()) { refreshToken = extractBearerToken(request); }
    - String newRefresh = refreshTokenService.rotate(refreshToken);
    - String email = jwtUtil.getEmailFromToken(newRefresh);
    + RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
    + String accessToken = jwtUtil.generateAccessToken(rotation.email(), role);
    - .body(new AccessTokenResponse(accessToken, newRefresh));
    + .body(new AccessTokenResponse(accessToken));
    ```
    `/refresh` 는 **쿠키에서만** 읽는다(`Authorization: Bearer` 예비 경로와 `extractBearerToken` 삭제).
    응답 모양은 그대로(`LoginResponse.refreshToken`, `AccessTokenResponse.refreshToken` 필드는 남고 값만 `null`).
    쿠키는 기존대로 `httpOnly`, `secure = app.cookie.secure`, `SameSite = app.cookie.same-site`(운영 기본 true/Lax).
  - `frontend/src/lib/installFetchAuth.ts` — `getRefreshToken`/`setTokens` 삭제. `scrubStoredRefreshToken()`(export) 추가:
    `installFetchAuth()` 가 처음 불릴 때 예전 버전이 저장한 `localStorage.user.refreshToken` 을 지운다.
    `refreshAccessToken`·`bootstrapAuthSession` 은 `Authorization` 없이 `credentials: "include"` 로만 갱신, 새 액세스 토큰만 `setAccessToken` 으로 저장.
    ```diff
    - const refreshToken = getRefreshToken();
    - if (refreshToken) { headers.Authorization = `Bearer ${refreshToken}`; }
    + // 리프레시 토큰은 httpOnly 쿠키로 자동 전송된다(credentials: "include").
    + headers: { [RETRY_HEADER]: "1" },
    - setTokens(accessToken, payload?.refreshToken);
    + setAccessToken(accessToken);
    ```
  - `frontend/src/lib/api.ts` — `getStoredRefreshToken`/`setStoredTokens` 삭제 → `setStoredAccessToken`(저장 시 `refreshToken` 키도 지움).
    갱신은 `api.post("/api/auth/refresh")`(withCredentials 쿠키).
- **Google 로그인 경로 확인(코드 읽기)**: `Login.tsx` → `POST /api/auth/google` → `AuthController.googleLogin` 이
  `refreshToken`·`accessToken`·`rememberMe` 쿠키를 굽고 본문에 `token`(액세스)·email·nickname·role 을 준다 →
  화면은 `data.token` 을 `localStorage.user.accessToken` 에 저장(`data.refreshToken` 은 이제 `undefined` 로 저장됨, 무해) →
  401 이 나면 `installFetchAuth`/`api.ts` 가 쿠키로 `/api/auth/refresh` → 새 쿠키 + 새 액세스 토큰. 쿠키만으로 끝까지 이어진다.
- **확인**
  - `RefreshTokenServiceTest`(Mockito, 메모리 저장소) 5개 통과: 원문이 DB 에 안 남음 · 회전하면 새 토큰 · 유예 안 같은 토큰 재요청은 같은 새 토큰 ·
    유예 지난 재사용이면 전부 폐기 · 만료 거부 · 이상한 토큰 로그아웃 무예외.
  - 8091 인스턴스: 쿠키 없이 `/refresh` → 401, `Authorization: Bearer abc` 만 → 401, 모르는 쿠키 → 401 `다시 로그인해 주세요.`
  - `tsc --noEmit -p tsconfig.app.json`: 내 두 파일 오류 0(남은 1건은 `Lounge.tsx`, 다른 영역). `eslint src/lib/api.ts src/lib/installFetchAuth.ts` 0건.
- **남은 것**
  - 실제 Google 로그인 → 갱신까지 브라우저로 끝까지 해 보지 못했다(로그인은 사용자가 직접 해야 함). 로그인 후 15분 이상 두었다가 화면이 계속 동작하는지 한 번 봐 주세요.
  - **Safari·교차 사이트 주의**: 예전 코드는 "Safari 가 쿠키를 놓칠 때" 를 대비해 localStorage 토큰을 헤더로 보냈다. 이제 쿠키만 쓰므로
    프론트와 API 가 **같은 사이트**(예: `musclehub.co.kr` ↔ `api.musclehub.co.kr`)여야 한다. 운영 설정(`SameSite=Lax`, secure)은 이 전제와 맞다.
    다른 도메인으로 배포하면 `SameSite=None; Secure` 가 필요하고 Safari ITP 에 막힐 수 있다.
  - 배포 직후 기존 사용자는 그대로 로그인 유지된다(옛 행을 원문으로도 찾음). 단 이번 배포 전에 탈취된 토큰도 한 번은 쓸 수 있다 → 걱정되면 배포 후 `refresh_tokens` 를 비워 전원 재로그인.
  - 유예 캐시는 서버 메모리라 서버가 여러 대면 다른 인스턴스에서는 유예 시간 안에 새 토큰을 하나 더 발급한다(로그아웃되지는 않음).
  - **남은 것 (다른 영역 필요)**: `frontend/src/pages/Login.tsx:8,48`, `components/ProtectedRoute.tsx:23-54`, `layouts/Header.tsx:10,90` 이
    아직 `refreshToken` 을 읽거나 localStorage 에 옮겨 담는다. 값이 이제 늘 `null/undefined` 라 동작 문제는 없지만 코드에서 지우는 게 맞다(프론트 셸 영역).
    액세스 토큰도 아직 localStorage 에 있다(15분짜리, 이번 범위 밖).

### 13. 예상 못 한 오류가 500 원문으로 나가고, 만료 토큰으로 로그아웃하면 500

- **원인**: `GlobalExceptionHandler` 가 `ResponseStatusException` 과 `MethodArgumentNotValidException` 만 처리. 로그아웃은
  `AuthController.logout:134` 에서 만료된 리프레시 JWT 를 `jwtUtil.getEmailFromToken` 으로 파싱 → `ExpiredJwtException` → 500.
- **고친 코드**
  - `B/exception/GlobalExceptionHandler.java` — 처리기 추가(응답 모양 `ApiErrorResponse` 그대로, 원문은 로그에만):
    | 예외 | 상태 | 메시지 |
    |---|---|---|
    | `DataIntegrityViolationException` | 409 | 이미 처리되었거나 중복된 요청이에요. |
    | `IllegalArgumentException` | 400 | 요청 내용을 처리할 수 없어요. 입력값을 확인해 주세요. |
    | `BindException`, `HandlerMethodValidationException`, `HttpMessageNotReadableException`, `TypeMismatchException` | 400 | 입력값을 다시 확인해 주세요. |
    | `JwtException` | 401 | 로그인이 만료되었어요. 다시 로그인해 주세요. |
    | `AuthenticationException` / `AccessDeniedException` | 401 / 403 | 로그인이 필요해요. / 이 기능을 쓸 권한이 없어요. |
    | `MaxUploadSizeExceededException` | 413 | 파일이 너무 커요. ... |
    | `ServletException`, `ErrorResponseException`(404 정적 리소스, 405 등) | 원래 상태 | 상태별 한국어 문장 |
    | 그 외 `Exception` | 500 | 일시적인 문제로 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요. (`log.error` 로 스택 기록) |
    `ResponseStatusException` 에 reason 이 비어 있으면 상태별 한국어 문장으로 채운다.
  - `B/controller/AuthController.java` — `logout`: JWT 파싱 제거, `refreshTokenService.revokeByToken(refreshToken)` 을 try/catch 로 감쌈. 쿠키 삭제는 항상 실행.
    ```diff
    - String email = jwtUtil.getEmailFromToken(refreshToken);
    - refreshTokenService.revokeAllByUserEmail(email);
    + try { refreshTokenService.revokeByToken(refreshToken); }
    + catch (RuntimeException e) { log.debug("Logout token revoke skipped: {}", e.getClass().getSimpleName()); }
    ```
- **확인**: 만료/위조 JWT 모양 쿠키로 `/api/auth/logout` → **200**. 잘못된 이메일 형식 로그인 → 400 한국어 메시지.
- **남은 것**: 보호된 경로의 "없는 주소"는 보안 필터가 먼저 401 을 낸다(스프링 기본 JSON). 화면이 쓰는 경로에는 영향 없음.

### 14. 이메일 인증 코드가 서버 콘솔에 찍히고, 발송 요청에 IP 제한·형식 검사가 없음

- **원인**: `EmailVerificationService.sendCode` 의 `System.out.println("DEBUG >>> ... text=" + text)` 와 `"[DEV] verification code ... = " + code`.
  `AuthController` 의 `@RequestBody` 에 `@Valid` 가 없어 `@Email`·`@NotBlank` 가 동작하지 않음.
- **고친 코드**
  - `B/service/EmailVerificationService.java` — 두 `System.out` 삭제, `log.debug("Verification code issued for {}", maskEmail(email))`(코드 없음, 이메일 가림).
    새 오버로드 `sendCode(email, from, clientIp)`(IP 당 10분 10회), `verify(email, code, clientIp)`(IP 당 10분 30회). 기존 이메일 당 60초 제한·코드 당 5회 제한은 그대로.
  - `B/controller/AuthController.java` — `send`, `verify`, `login`, `googleLogin` 에 `@Valid`, IP 를 서비스에 넘김.
- **확인**: `{"email":"notanemail"}` 로그인 → 400 `email 올바른 형식의 이메일 주소여야 합니다`. 인증 메일 실제 발송은 시험하지 않았다(실제 메일이 나감).

### 15. 로그인 실패 문장으로 가입 여부가 드러나고, 비밀번호 무차별 대입 제한이 없음

- **원인**: `UserService.login:54-59` 가 "이메일이 존재하지 않습니다." / "비밀번호가 일치하지 않습니다." 를 따로 돌려줌. 시도 제한 없음.
- **고친 코드**
  - `B/service/UserService.java` — `login(email, pw, clientIp)` 추가(기존 2인자 버전은 이쪽을 부름).
    - 한 문장: `"이메일 또는 비밀번호가 올바르지 않습니다."`
    - 같은 `(이메일 + IP)` 로 15분 안에 5번 틀리면 429 `"로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요."`. 성공하면 카운터 초기화.
    - 없는 이메일이어도 더미 BCrypt 해시와 비교해 응답 시간으로 가입 여부를 알 수 없게 함.
    ```diff
    - .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일이 존재하지 않습니다."));
    - throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비밀번호가 일치하지 않습니다.");
    + if (rateLimiter.isBlocked(throttleKey, LOGIN_FAIL_LIMIT)) throw ... TOO_MANY_REQUESTS ...
    + if (user == null || !matches) { rateLimiter.recordFailure(throttleKey, LOGIN_FAIL_WINDOW);
    +     throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."); }
    ```
  - `B/controller/AuthController.java` — `login` 에 IP 당 5분 30회 제한(여러 이메일을 돌려 가며 시도하는 것 대비).
- **확인**: 없는 이메일로 6번 → 1~5번 401(같은 문장), 6번째 **429**.

### 16. Google 로그인이 이메일 인증 여부를 보지 않음

- **원인**: `AuthController.googleLogin:176` 이 `payload.getEmail()` 만 보고 `email_verified` 를 확인하지 않음 → 구글이 확인하지 않은 이메일로 같은 이메일의 기존 계정에 들어갈 수 있음.
- **고친 코드**: `B/controller/AuthController.java` — `googleLogin`
  ```diff
  + if (payload.getEmail() == null || !Boolean.TRUE.equals(payload.getEmailVerified())) {
  +     throw new ResponseStatusException(UNAUTHORIZED, "구글 계정의 이메일 인증이 확인되지 않았어요.");
  + }
  + String email = payload.getEmail().trim().toLowerCase();
  ```
  IP 당 5분 30회 제한도 추가.
- **확인**: 컴파일 · 코드 읽기. 실제 Google 토큰으로는 시험하지 못했다(사용자 로그인 필요).

### 20. 일반 회원이 아무 폴더 파일 목록을 볼 수 있음

- **원인**: `/api/files/list`, `/list/paged`(`FileController:187-253`)가 USER 에게 열려 있고 `folder` 를 마음대로 받음. `sanitizeFolder`(`:259-266`)는 `..` 문자열만 지워서 하위 경로를 다 열람 가능.
- **실제로 쓰는 폴더 조사**: `UploadDropzone` 기본 `gallery`(Gallery 화면, WriteProtein 영수증), `attendance`(Attendance), `brag`(BragWrite·BragDetail),
  `events`(AdminEventForm). 목록 조회는 `Gallery.tsx`(일반 회원, `gallery`), `AdminEventForm.tsx`(`events`), `adminApi.ts`(`gallery`). 로컬 `backend/uploads` 에도 이 네 폴더뿐.
- **고친 코드**: `B/controller/FileController.java`
  - `sanitizeFolder` 삭제 → `resolveFolder`: 허용 목록 `gallery, attendance, brag, events, protein` 밖이면 400 `"허용되지 않은 폴더예요."`.
  - 업로드: `events` 는 운영진만(403).
  - 목록(`list`, `listPaged`) → `resolveListFolder`: 일반 회원은 `gallery` 만(공개 갤러리 화면이 쓰므로), 나머지는 운영진만(403).
  - 역할 판단은 `RoleUtils.isAdmin(Authentication)`.
  - 완전 ADMIN 전용으로 만들면 `Gallery.tsx` 의 일반 회원 갤러리가 깨져서, gallery 만 회원에게 열어 두었다.
- **확인**: 8091 인스턴스 — 회원 `../../etc` 업로드 400, 회원 `events` 업로드 403, 회원 `gallery` 목록 200, 회원 `brag` 목록 403, 운영진 `brag` 페이지 목록 200.
- **남은 것 (다른 영역 필요)**: `frontend/src/pages/WriteProtein.tsx:300` 의 `UploadDropzone` 이 폴더를 안 정해 **단백질 영수증 사진이 공개 갤러리(gallery)에 섞인다**.
  `folder="protein"` 으로 바꿔야 한다(백엔드는 이미 `protein` 허용). 기존에 gallery 에 섞인 영수증은 운영진이 정리 필요.

### 24. 관리자가 남의 자랑글·댓글·후기를 지우지 못함(+ 자랑방 목록 N+1)

- **원인**: DB 역할은 `ROLE_ADMIN` 인데 `BragPostServiceImpl.isAdmin`, `BragInteractionServiceImpl.isAdmin`, `ReviewServiceImpl.update/delete` 가 `"ADMIN".equalsIgnoreCase(role)` 로 비교.
  `BragPostServiceImpl.list` 는 글마다 `bragLikeRepository.countByPostId` (페이지 20개면 쿼리 20번 추가).
- **고친 코드**
  - 세 파일 모두 `RoleUtils.isAdmin(user)` 사용(`ROLE_ADMIN`·`ADMIN` 둘 다 인정).
    ```diff
    - return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    + return RoleUtils.isAdmin(user);
    ```
  - `B/service/BragPostServiceImpl.java` — `list`: 페이지의 글 id 들로 `countLikesByPostIds(ids)` 한 번
    (`select bl.bragPost.id, count(bl) from BragLike bl where bl.bragPost.id in :ids group by bl.bragPost.id`, `EntityManager` 사용 — 저장소 파일은 다른 영역이라 건드리지 않음).
    ```diff
    - .map(p -> BragPostResponse.from(p, bragLikeRepository.countByPostId(p.getId())));
    + Map<Long, Long> likeCounts = countLikesByPostIds(posts.getContent().stream().map(BragPost::getId).toList());
    + return posts.map(p -> BragPostResponse.from(p, likeCounts.getOrDefault(p.getId(), 0L)));
    ```
- **확인**: 컴파일. 관리자 삭제는 관리자 로그인이 필요해 화면으로 보지 못했다.
- **남은 것**: `ProteinShareServiceImpl:148` 은 `role.contains("ADMIN")` 로 이미 둘 다 통과(다른 영역, 그대로 둠).

### 25. 문의 작성자가 남의 userId 를 넣을 수 있음

- **원인**: `SupportController.create:31` `.userId(req.getUserId())`, `InquiryRequest.userId` 를 본문에서 그대로 믿음.
- **고친 코드**: `B/controller/SupportController.java` — `create` 가 `@AuthenticationPrincipal` 이메일로 사용자를 찾아 userId 를 채움(비로그인은 null).
  본문 `userId` 는 무시(`InquiryRequest.userId` 필드는 예전 클라이언트 호환용으로 남김, 주석 표시). IP 당 10분 5건 제한 추가.
  ```diff
  - .userId(req.getUserId())
  + .userId(userId)   // 로그인 principal 로 조회
  ```
- **확인**: 컴파일.

### 27. Actuator·Swagger 경로가 permitAll, /uploads 규칙 중복

- **고친 코드**: `B/config/SecurityConfig.java`
  ```diff
  - .requestMatchers("/actuator/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
  ...
  - .requestMatchers("/uploads/**").hasAnyRole("USER", "ADMIN")
  ```
  `GET /uploads/**` permitAll 한 줄만 남음(그 외 메서드는 `anyRequest().authenticated()`).
- **확인**: `/actuator/health` → 401.

### 28. CORS 가 패턴 + credentials 조합

- **원인**: `CorsConfig:140` `allowedOrigins.forEach(cfg::addAllowedOriginPattern)` + `setAllowCredentials(true)` → 설정에 `*` 나 패턴이 들어가면 아무 사이트가 쿠키를 실어 API 를 호출 가능. `setExposedHeaders(List.of("Set-Cookie"))` 는 브라우저가 어차피 노출하지 않는 헤더라 의미 없음.
- **고친 코드**: `B/config/CorsConfig.java`
  ```diff
  - allowedOrigins.forEach(cfg::addAllowedOriginPattern);
  + List<String> exactOrigins = ... trim, 끝의 "/" 제거 ...;
  + if (origin.contains("*")) throw new IllegalStateException("cors.allowed-origins must list exact origins; ...");
  + cfg.setAllowedOrigins(exactOrigins);
  - cfg.setExposedHeaders(List.of("Set-Cookie"));
  ```
- **확인**: `Origin: https://evil.example` 사전 요청 → 403, `Origin: http://localhost:5173` → 200 + `Access-Control-Allow-Origin: http://localhost:5173`.
- **남은 것**: 배포 환경변수 `CORS_ALLOWED_ORIGINS` 에 `*` 나 패턴이 있으면 **서버가 시작되지 않는다**(의도). 정확한 출처를 쉼표로 나열해야 한다.

### 29. 감사 로그가 프록시 IP 를 기록하고, 요청마다 동기로 DB 에 씀

- **고친 코드**
  - `B/service/AuditLogService.java` — `log(...)` 에 `@Async`(`AsyncConfig` 의 `@EnableAsync`, 스프링 부트 기본 `applicationTaskExecutor`).
  - `B/config/AuditLogFilter.java` — `resource` 255자·`summary` 1000자·UA 300자로 자르기(컬럼 길이 초과로 저장 실패 방지), 호출을 try/catch.
  - `backend/src/main/resources/application.properties` — `server.forward-headers-strategy=framework` 추가 →
    `request.getRemoteAddr()` 가 `X-Forwarded-For` 의 실제 접속 IP 가 된다(감사 로그와 이번에 넣은 IP 별 요청 제한 모두 이 값을 씀).
- **확인**: 8091 인스턴스 기동·요청 정상(POST 요청들이 감사 로그 경로를 탔고 오류 없음).
- **남은 것**: `framework` 전략은 들어온 `X-Forwarded-For` 를 그대로 믿는다. **백엔드가 nginx/ALB 뒤에만 있고 직접 노출되지 않아야** 한다
  (직접 노출되면 헤더를 꾸며 IP 제한을 피할 수 있음). 프록시가 `X-Forwarded-For` 를 덮어쓰도록(`proxy_set_header X-Forwarded-For $remote_addr` 또는 `$proxy_add_x_forwarded_for`) 확인 필요.

### 7(일부, 설정만). 테스트 설정 파일에 실제 비밀값이 평문으로 들어 있음

- **원인**: `backend/src/main/resources/application-test.properties` 의 `spring.mail.password`, `jwt.secret` 가 평문(깃에 커밋됨).
- **고친 코드**: 두 줄을 환경변수 + 비밀이 아닌 기본값으로 교체(값은 기록하지 않음).
  ```diff
  - spring.mail.password=<평문 — 기록 생략>
  + spring.mail.password=${TEST_MAIL_PASSWORD:dummy-test-mail-password}
  - jwt.secret=<평문 — 기록 생략>
  + jwt.secret=${TEST_JWT_SECRET:test-only-jwt-secret-0123456789-abcdefghij}
  ```
- **남은 것 (사람이 해야 함)**
  - 깃 기록에는 옛 값이 그대로 남는다(기록은 건드리지 않음). **Gmail 앱 비밀번호를 폐기하고 새로 발급**해야 한다.
  - 같은 `jwt.secret` 를 운영에서 쓴 적이 있다면 운영 `JWT_SECRET` 도 바꿔야 한다(바꾸면 모든 사용자 재로그인).
  - `application-test.properties` 의 `spring.datasource.password` 도 평문이다(로컬 MySQL 용 짧은 값으로 보임, 테스트가 그 DB 에 붙으므로 이번엔 그대로 둠). 운영 DB 와 같은 비밀번호라면 **운영 DB 비밀번호 교체** 필요.

---

## 검증 요약

- `gradlew -p backend compileJava compileTestJava` 성공.
- `gradlew -p backend test --tests com.ajou.muscleup.service.RefreshTokenServiceTest` — 5/5 통과.
- 새 코드를 8091 포트에 따로 띄워 curl 로 확인(위 각 항목의 "확인"). 공용 8080 서버는 다른 작업이 쓰고 있어 재시작하지 않았다 → **8080 은 아직 옛 코드**다. 다시 띄워야 반영된다.
  8091 실행 중 `ddl-auto=update` 로 로컬 DB `refresh_tokens` 에 `revoked_at`, `replaced_by` 컬럼이 추가되었다(nullable, 옛 코드에도 무해).
- 업로드 시험용 액세스 토큰은 존재하지 않는 테스트 이메일로 로컬에서만 발급했고, 시험 업로드 파일 1개는 삭제했다.
- 프론트: `tsc --noEmit` 에서 내 파일 오류 0, `eslint src/lib/api.ts src/lib/installFetchAuth.ts` 0건.
- 화면(데스크톱/375px) 확인은 하지 않았다 — 바뀐 것은 화면이 아니라 토큰 저장 방식이고, 실제 로그인 흐름 확인은 Google 로그인이 필요하다.
