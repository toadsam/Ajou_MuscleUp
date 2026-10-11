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
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.ajou.muscleup.security.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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

        ResponseCookie clearRefresh = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();
        ResponseCookie clearAccess = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();
        ResponseCookie clearRememberMe = ResponseCookie.from("rememberMe", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearRefresh.toString())
                .header(HttpHeaders.SET_COOKIE, clearAccess.toString())
                .header(HttpHeaders.SET_COOKIE, clearRememberMe.toString())
                .build();
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
        String email = payload.getEmail().trim().toLowerCase();
        String name = (String) payload.get("name");
        String nickname = name != null && !name.isBlank() ? name : email.split("@")[0];

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setName(name != null ? name : nickname);
            u.setNickname(nickname);
            u.setRole("ROLE_USER");
            u.setPassword(userService.encodePassword("google-" + UUID.randomUUID()));
            return userRepository.save(u);
        });

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
}
