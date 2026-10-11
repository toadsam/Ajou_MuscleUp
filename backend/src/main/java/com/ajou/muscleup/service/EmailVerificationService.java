// src/main/java/com/ajou/muscleup/service/EmailVerificationService.java
package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.EmailVerification;
import com.ajou.muscleup.repository.EmailVerificationRepository;
import com.ajou.muscleup.security.RateLimiter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;

import static org.springframework.http.HttpStatus.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private final EmailVerificationRepository repo;
    private final EmailSender emailSender;  // ★ 비동기 메일 컴포넌트
    private final RateLimiter rateLimiter;

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
        String subject = "[득근득근] 이메일 인증코드";
        String text = "인증코드: " + code + "\n유효기간: 10분\n(타인에게 공유 금지)";
        emailSender.sendSimpleAsync(email, subject, text);
        // 인증 코드는 로그에 남기지 않는다(운영 로그가 새면 남의 계정 인증에 쓰일 수 있음).
        log.debug("Verification code issued for {}", maskEmail(email));
    }

    /** IP 당 10분에 10번까지 인증 코드 발송. 여러 이메일로 메일 폭탄을 보내는 것을 막는다. */
    public void sendCode(String rawEmail, String fromAddress, String clientIp) {
        rateLimiter.check("email-send:" + (clientIp == null ? "-" : clientIp), 10, Duration.ofMinutes(10),
                "인증 메일 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
        sendCode(rawEmail, fromAddress);
    }

    /** IP 당 10분에 30번까지 코드 확인. 코드별 5회 제한과 함께 무차별 대입을 막는다. */
    public void verify(String rawEmail, String code, String clientIp) {
        rateLimiter.check("email-verify:" + (clientIp == null ? "-" : clientIp), 30, Duration.ofMinutes(10),
                "인증 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
        verify(rawEmail, code);
    }

    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.charAt(0) + "***" + email.substring(at);
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
