package com.ajou.muscleup.controller;

import com.ajou.muscleup.service.EmailVerificationService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/email")
@RequiredArgsConstructor
public class AuthController {

    private final EmailVerificationService emailSvc;

    // 네이버는 From 이 계정 메일과 같아야 함
    @Value("${spring.mail.username}")
    private String from;

    @PostMapping("/send-code")
    public ResponseEntity<Void> send(@RequestBody SendReq req) {
        emailSvc.sendCode(req.getEmail(), from);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/verify")
    public ResponseEntity<Void> verify(@RequestBody VerifyReq req) {
        emailSvc.verify(req.getEmail(), req.getCode());
        return ResponseEntity.ok().build();
    }

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
}
