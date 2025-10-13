package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.JwtUtil;
import com.ajou.muscleup.dto.LoginResponse;
import com.ajou.muscleup.dto.AccessTokenResponse;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.service.EmailVerificationService;
import com.ajou.muscleup.service.UserService;
import com.ajou.muscleup.service.RefreshTokenService;
import com.ajou.muscleup.repository.UserRepository;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpHeaders;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final EmailVerificationService emailSvc;
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;

    @Value("${spring.mail.username}")
    private String from;

    // ??1) ?¥Î©î???∏Ï¶ù ÏΩîÎìú ?ÑÏÜ°
    @PostMapping("/email/send-code")
    public ResponseEntity<Void> send(@RequestBody SendReq req) {
        emailSvc.sendCode(req.getEmail(), from);
        return ResponseEntity.ok().build();
    }

    // ??2) ?¥Î©î???∏Ï¶ù ?ïÏù∏
    @PostMapping("/email/verify")
    public ResponseEntity<Void> verify(@RequestBody VerifyReq req) {
        emailSvc.verify(req.getEmail(), req.getCode());
        return ResponseEntity.ok().build();
    }

    // ??3) Î°úÍ∑∏????JWT + ?†Ï? ?ïÎ≥¥ Î∞òÌôò
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginReq req) {
        User user = userService.login(req.getEmail(), req.getPassword());

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
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(refreshToken).toString())
                .body(response);
    }

    // 4) ?°ÏÑ∏???†ÌÅ∞ ?¨Î∞úÍ∏?(Î¶¨ÌîÑ?àÏãú Ïø†ÌÇ§ ?ÑÏöî)
    @PostMapping("/refresh")
    public ResponseEntity<AccessTokenResponse> refresh(@CookieValue(name = "refreshToken", required = false) String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).build();
        }

        // ?åÏ†Ñ(rotate) + ???°ÏÑ∏???†ÌÅ∞ Î∞úÍ∏â
        String newRefresh = refreshTokenService.rotate(refreshToken);
        String email = jwtUtil.getEmailFromToken(newRefresh);
        String role = userRepository.findByEmail(email)
                .map(User::getRole)
                .map(r -> r != null && r.startsWith("ROLE_") ? r : "ROLE_" + r)
                .orElse("ROLE_USER");
        String accessToken = jwtUtil.generateAccessToken(email, role);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(newRefresh).toString())
                .body(new AccessTokenResponse(accessToken));
    }

    // 5) Î°úÍ∑∏?ÑÏõÉ (Î¶¨ÌîÑ?àÏãú ?†ÌÅ∞ ?úÍ±∞)
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = "refreshToken", required = false) String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            String email = jwtUtil.getEmailFromToken(refreshToken);
            refreshTokenService.revokeAllByUserEmail(email);
        }
        // Ïø†ÌÇ§ ?úÍ±∞
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false) // Î°úÏª¨ Í∞úÎ∞ú ?òÍ≤Ω?êÏÑú false, ?¥ÏòÅ?êÏÑú??true Í∂åÏû•
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    private ResponseCookie buildRefreshCookie(String token) {
        return ResponseCookie.from("refreshToken", token)
                .httpOnly(true)
                .secure(false) // ?¥ÏòÅ Î∞∞Ìè¨ ??true + sameSite("None") Í∂åÏû•
                .sameSite("Lax")
                .path("/")
                .maxAge(60L * 60 * 24 * 14) // 14¿œ
                .build();
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
    }
}


