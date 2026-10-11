package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.JwtUtil;
import com.ajou.muscleup.dto.AccessTokenResponse;
import com.ajou.muscleup.dto.LoginResponse;
import com.ajou.muscleup.dto.UserDTO;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.EmailVerificationService;
import com.ajou.muscleup.service.RefreshTokenService;
import com.ajou.muscleup.service.UserService;
import com.ajou.muscleup.service.SocialLoginService;
import com.ajou.muscleup.service.AccountDeletionService;
import com.ajou.muscleup.service.KakaoOAuthClient;
import com.ajou.muscleup.entity.SocialProvider;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.ajou.muscleup.security.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final EmailVerificationService emailSvc;
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;
    private final SocialLoginService socialLoginService;
    private final KakaoOAuthClient kakaoOAuthClient;
    private final AccountDeletionService accountDeletionService;

    @Value("${spring.mail.username}")
    private String from;

    @Value("${google.client-id:}")
    private String googleClientId;

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.same-site:Lax}")
    private String cookieSameSite;

    @PostMapping("/email/send-code")
    public ResponseEntity<Void> send(@Valid @RequestBody SendReq req, HttpServletRequest request) {
        emailSvc.sendCode(req.getEmail(), from, request.getRemoteAddr());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/email/verify")
    public ResponseEntity<Void> verify(@Valid @RequestBody VerifyReq req, HttpServletRequest request) {
        emailSvc.verify(req.getEmail(), req.getCode(), request.getRemoteAddr());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginReq req, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        rateLimiter.check("login-ip:" + ip, 30, Duration.ofMinutes(5),
                "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
        User user = userService.login(req.getEmail(), req.getPassword(), ip);
        boolean rememberMe = req.getRememberMe() == null || Boolean.TRUE.equals(req.getRememberMe());

        String accessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.issueFor(user);

        LoginResponse response = new LoginResponse(
                accessToken,
                user.getEmail(),
                user.getNickname(),
                user.getRole()
        );

        return ResponseEntity
                .ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(refreshToken, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildAccessCookie(accessToken, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildRememberMeCookie(rememberMe).toString())
                // 리프레시 토큰은 httpOnly 쿠키로만 준다(본문의 refreshToken 은 항상 null).
                .body(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            @CookieValue(name = "rememberMe", required = false) String rememberMeCookie
    ) {
        // 리프레시 토큰은 httpOnly 쿠키에서만 읽는다(Authorization 헤더로 받던 예비 경로는 없앴다).
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).build();
        }
        // Default to persistent login when rememberMe cookie is missing.
        boolean rememberMe = rememberMeCookie == null || "1".equals(rememberMeCookie);

        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
        String role = rotation.role();
        role = role == null ? "ROLE_USER" : (role.startsWith("ROLE_") ? role : "ROLE_" + role);
        String accessToken = jwtUtil.generateAccessToken(rotation.email(), role);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(rotation.token(), rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildAccessCookie(accessToken, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildRememberMeCookie(rememberMe).toString())
                .body(new AccessTokenResponse(accessToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = "refreshToken", required = false) String refreshToken) {
        // 만료·위조된 토큰이어도 500 을 내지 않는다. 토큰을 해석하지 않고 DB 해시로만 찾는다.
        try {
            refreshTokenService.revokeByToken(refreshToken);
        } catch (RuntimeException e) {
            log.debug("Logout token revoke skipped: {}", e.getClass().getSimpleName());
        }

        return withClearedAuthCookies(ResponseEntity.ok()).build();
    }

    /**
     * 회원 탈퇴(0단계 PR 8). 본문 { "confirm": "탈퇴" } 가 있어야 한다(실수로 누르는 것 방지).
     * 개인 데이터를 지우고 계정을 "탈퇴한 회원"으로 익명화한 뒤 로그인 쿠키를 지운다. 되돌릴 수 없다.
     */
    @PostMapping("/withdraw")
    public ResponseEntity<Void> withdraw(@AuthenticationPrincipal String email, @RequestBody(required = false) Map<String, String> body) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        if (body == null || !"탈퇴".equals(body.get("confirm"))) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "확인 문구를 입력해 주세요.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
        accountDeletionService.delete(user);
        return withClearedAuthCookies(ResponseEntity.ok()).build();
    }

    /** 로그인 유지 · 접근 · 자동 로그인 쿠키를 지운다(로그아웃 · 탈퇴) */
    private ResponseEntity.BodyBuilder withClearedAuthCookies(ResponseEntity.BodyBuilder builder) {
        for (String name : List.of("refreshToken", "accessToken", "rememberMe")) {
            builder.header(HttpHeaders.SET_COOKIE, ResponseCookie.from(name, "")
                    .httpOnly(true)
                    .secure(cookieSecure)
                    .sameSite(cookieSameSite)
                    .path("/")
                    .maxAge(0)
                    .build()
                    .toString());
        }
        return builder;
    }

    @PostMapping("/google")
    public ResponseEntity<LoginResponse> googleLogin(@Valid @RequestBody GoogleLoginReq req, HttpServletRequest request) {
        if (googleClientId == null || googleClientId.isBlank()) {
            return ResponseEntity.status(500).build();
        }
        rateLimiter.check("google-login-ip:" + request.getRemoteAddr(), 30, Duration.ofMinutes(5),
                "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
        boolean rememberMe = req.getRememberMe() == null || Boolean.TRUE.equals(req.getRememberMe());
        GoogleIdToken.Payload payload = verifyGoogleToken(req.getIdToken());
        if (payload == null) {
            return ResponseEntity.status(401).build();
        }
        // 구글이 확인한 이메일만 받는다. 확인되지 않은 이메일로 기존 계정에 들어오는 것을 막는다.
        if (payload.getEmail() == null || !Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "구글 계정의 이메일 인증이 확인되지 않았어요.");
        }
        // Google 회원 고유 번호(sub)로 먼저 찾고, 없으면 인증된 이메일로 찾아 연결한다(예전 가입자 자동 이전)
        User user = socialLoginService.resolveUser(new SocialLoginService.SocialProfile(
                SocialProvider.GOOGLE, payload.getSubject(), payload.getEmail(), true, (String) payload.get("name")));
        return loginResponse(user, rememberMe);
    }

    /**
     * 카카오 로그인. 화면이 카카오 로그인 창에서 받은 code 를 보내면 서버가 카카오와 바꿔 회원 정보를 읽는다.
     * 키(KAKAO_REST_API_KEY · KAKAO_REDIRECT_URIS)가 없으면 503 "준비 중".
     */
    @PostMapping("/kakao")
    public ResponseEntity<LoginResponse> kakaoLogin(@Valid @RequestBody KakaoLoginReq req, HttpServletRequest request) {
        rateLimiter.check("kakao-login-ip:" + request.getRemoteAddr(), 30, Duration.ofMinutes(5),
                "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
        boolean rememberMe = req.getRememberMe() == null || Boolean.TRUE.equals(req.getRememberMe());
        SocialLoginService.SocialProfile profile = kakaoOAuthClient.fetchProfile(req.getCode(), req.getRedirectUri());
        return loginResponse(socialLoginService.resolveUser(profile), rememberMe);
    }

    /** 로그인 성공 공통: 액세스 토큰 + 리프레시 쿠키(httpOnly) */
    private ResponseEntity<LoginResponse> loginResponse(User user, boolean rememberMe) {
        String accessToken = jwtUtil.generateAccessToken(user.getEmail(), user.getRole());
        String refreshToken = refreshTokenService.issueFor(user);
        LoginResponse response = new LoginResponse(accessToken, user.getEmail(), user.getNickname(), user.getRole());

        return ResponseEntity
                .ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(refreshToken, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildAccessCookie(accessToken, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildRememberMeCookie(rememberMe).toString())
                .body(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> me(@AuthenticationPrincipal String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Unauthorized"));
        return ResponseEntity.ok(UserDTO.from(user));
    }

    private GoogleIdToken.Payload verifyGoogleToken(String idToken) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(List.of(googleClientId))
                    .build();
            GoogleIdToken token = verifier.verify(idToken);
            return token != null ? token.getPayload() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private ResponseCookie buildRefreshCookie(String token, boolean rememberMe) {
        long refreshCookieMaxAge = Math.max(60, jwtUtil.getRefreshTokenExpirationMs() / 1000L);
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("refreshToken", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/");
        if (rememberMe) {
            builder.maxAge(refreshCookieMaxAge);
        }
        return builder.build();
    }

    private ResponseCookie buildAccessCookie(String token, boolean rememberMe) {
        long accessCookieMaxAge = Math.max(60, jwtUtil.getAccessTokenExpirationMs() / 1000L);
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("accessToken", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/");
        if (rememberMe) {
            builder.maxAge(accessCookieMaxAge);
        }
        return builder.build();
    }

    private ResponseCookie buildRememberMeCookie(boolean rememberMe) {
        long rememberCookieMaxAge = Math.max(60, jwtUtil.getRefreshTokenExpirationMs() / 1000L);
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("rememberMe", rememberMe ? "1" : "0")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/");
        if (rememberMe) {
            builder.maxAge(rememberCookieMaxAge);
        }
        return builder.build();
    }

    // ----------------- Request DTO -----------------

    @Getter
    static class SendReq {
        @NotBlank @Email
        private String email;
    }

    @Getter
    static class VerifyReq {
        @NotBlank @Email
        private String email;
        @NotBlank
        private String code;
    }

    @Getter
    static class LoginReq {
        @NotBlank @Email
        private String email;
        @NotBlank
        private String password;
        private Boolean rememberMe;
    }

    @Getter
    static class GoogleLoginReq {
        @NotBlank
        private String idToken;
        private Boolean rememberMe;
    }

    @Getter
    static class KakaoLoginReq {
        /** 카카오 로그인 창이 돌려준 인가 코드 */
        @NotBlank
        private String code;
        /** 카카오에 보낸 돌아올 주소(서버 허용 목록과 같아야 함) */
        @NotBlank
        private String redirectUri;
        private Boolean rememberMe;
    }
}
