// src/main/java/com/ajou/muscleup/service/EmailVerificationService.java
package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.EmailVerification;
import com.ajou.muscleup.repository.EmailVerificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private final EmailVerificationRepository repo;
    private final EmailSender emailSender;  // ★ 비동기 메일 컴포넌트

    private static final SecureRandom RND = new SecureRandom();

    public void sendCode(String rawEmail, String fromAddress) {
        final String email = rawEmail.trim().toLowerCase();

        // 60초 이내 재발송 제한
        repo.findTopByEmailOrderByCreatedAtDesc(email).ifPresent(last -> {
            if (last.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(60))) {
                throw new ResponseStatusException(TOO_MANY_REQUESTS, "1분 후에 다시 시도해주세요.");
            }
        });

        // 코드 생성 + 저장
        String code = String.format("%06d", RND.nextInt(1_000_000));
        LocalDateTime now = LocalDateTime.now();

        EmailVerification v = EmailVerification.builder()
                .email(email)
                .code(code)
                .createdAt(now)
                .expireAt(now.plusMinutes(10))
                .verified(false)
                .attempts(0)
                .build();
        repo.save(v);

        // ★ 요청은 즉시 200으로 끝내고, 메일은 비동기로 발송
        String subject = "[Ajou MuscleUp] 이메일 인증코드";
        String text = "인증코드: " + code + "\n유효기간: 10분\n(타인에게 공유 금지)";
        emailSender.sendSimpleAsync(fromAddress, email, subject, text);

        // (개발 편의) 콘솔에도 코드 찍어두면 테스트 쉬움
        System.out.println("[DEV] verification code for " + email + " = " + code);
    }

    public void verify(String rawEmail, String code) {
        final String email = rawEmail.trim().toLowerCase();
        EmailVerification v = repo.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "인증 요청이 없습니다."));

        if (v.isVerified()) return;
        if (v.getExpireAt().isBefore(LocalDateTime.now()))
            throw new ResponseStatusException(BAD_REQUEST, "인증코드가 만료되었습니다.");
        if (v.getAttempts() >= 5)
            throw new ResponseStatusException(TOO_MANY_REQUESTS, "시도 횟수를 초과했습니다.");

        if (!v.getCode().equals(code)) {
            v.setAttempts(v.getAttempts() + 1);
            repo.save(v);
            throw new ResponseStatusException(BAD_REQUEST, "인증코드가 일치하지 않습니다.");
        }

        v.setVerified(true);
        repo.save(v);
    }

    public boolean isVerified(String rawEmail) {
        return repo.findTopByEmailOrderByCreatedAtDesc(rawEmail.trim().toLowerCase())
                .map(EmailVerification::isVerified)
                .orElse(false);
    }
}
