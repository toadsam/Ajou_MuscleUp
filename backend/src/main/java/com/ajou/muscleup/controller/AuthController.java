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
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
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

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final long ACCESS_COOKIE_MAX_AGE = Duration.ofMinutes(15).getSeconds();
    private static final long REFRESH_COOKIE_MAX_AGE = Duration.ofDays(14).getSeconds();

    private final EmailVerificationService emailSvc;
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;

    @Value("${spring.mail.username}")
    private String from;

    @Value("${google.client-id:}")
    private String googleClientId;

    @PostMapping("/email/send-code")
    public ResponseEntity<Void> send(@RequestBody SendReq req) {
        emailSvc.sendCode(req.getEmail(), from);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/email/verify")
    public ResponseEntity<Void> verify(@RequestBody VerifyReq req) {
        emailSvc.verify(req.getEmail(), req.getCode());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginReq req) {
        User user = userService.login(req.getEmail(), req.getPassword());
        boolean rememberMe = Boolean.TRUE.equals(req.getRememberMe());

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
                .body(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(
            @CookieValue(name = "refreshToken", required = false) String refreshToken,
            @CookieValue(name = "rememberMe", required = false) String rememberMeCookie
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).build();
        }
        boolean rememberMe = "1".equals(rememberMeCookie);

        String newRefresh = refreshTokenService.rotate(refreshToken);
        String email = jwtUtil.getEmailFromToken(newRefresh);
        String role = userRepository.findByEmail(email)
                .map(User::getRole)
                .map(r -> r != null && r.startsWith("ROLE_") ? r : "ROLE_" + r)
                .orElse("ROLE_USER");
        String accessToken = jwtUtil.generateAccessToken(email, role);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(newRefresh, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildAccessCookie(accessToken, rememberMe).toString())
                .header(HttpHeaders.SET_COOKIE, buildRememberMeCookie(rememberMe).toString())
                .body(new AccessTokenResponse(accessToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = "refreshToken", required = false) String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            String email = jwtUtil.getEmailFromToken(refreshToken);
            refreshTokenService.revokeAllByUserEmail(email);
        }

        ResponseCookie clearRefresh = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        ResponseCookie clearAccess = ResponseCookie.from("accessToken", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        ResponseCookie clearRememberMe = ResponseCookie.from("rememberMe", "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
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
    public ResponseEntity<LoginResponse> googleLogin(@RequestBody GoogleLoginReq req) {
        if (googleClientId == null || googleClientId.isBlank()) {
            return ResponseEntity.status(500).build();
        }
        boolean rememberMe = Boolean.TRUE.equals(req.getRememberMe());
        GoogleIdToken.Payload payload = verifyGoogleToken(req.getIdToken());
        if (payload == null) {
            return ResponseEntity.status(401).build();
        }
        String email = payload.getEmail();
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
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("refreshToken", token)
                .httpOnly(true)
                .secure(false) // set true when behind HTTPS
                .sameSite("Lax")
                .path("/");
        if (rememberMe) {
            builder.maxAge(REFRESH_COOKIE_MAX_AGE);
        }
        return builder.build();
    }

    private ResponseCookie buildAccessCookie(String token, boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("accessToken", token)
                .httpOnly(true)
                .secure(false) // set true when behind HTTPS
                .sameSite("Lax")
                .path("/");
        if (rememberMe) {
            builder.maxAge(ACCESS_COOKIE_MAX_AGE);
        }
        return builder.build();
    }

    private ResponseCookie buildRememberMeCookie(boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("rememberMe", rememberMe ? "1" : "0")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/");
        if (rememberMe) {
            builder.maxAge(REFRESH_COOKIE_MAX_AGE);
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
