package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.JwtUtil;
import com.ajou.muscleup.dto.LoginResponse;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.service.EmailVerificationService;
import com.ajou.muscleup.service.UserService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final EmailVerificationService emailSvc;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    @Value("${spring.mail.username}")
    private String from;

    // ✅ 1) 이메일 인증 코드 전송
    @PostMapping("/email/send-code")
    public ResponseEntity<Void> send(@RequestBody SendReq req) {
        emailSvc.sendCode(req.getEmail(), from);
        return ResponseEntity.ok().build();
    }

    // ✅ 2) 이메일 인증 확인
    @PostMapping("/email/verify")
    public ResponseEntity<Void> verify(@RequestBody VerifyReq req) {
        emailSvc.verify(req.getEmail(), req.getCode());
        return ResponseEntity.ok().build();
    }

    // ✅ 3) 로그인 → JWT + 유저 정보 반환
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginReq req) {
        User user = userService.login(req.getEmail(), req.getPassword());

        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());

        LoginResponse response = new LoginResponse(
                token,
                user.getEmail(),
                user.getNickname(),
                user.getRole()
        );

        return ResponseEntity.ok(response);
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
