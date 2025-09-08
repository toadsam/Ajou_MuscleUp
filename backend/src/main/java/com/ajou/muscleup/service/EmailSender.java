// src/main/java/com/ajou/muscleup/service/EmailSender.java
package com.ajou.muscleup.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import jakarta.mail.internet.MimeMessage;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmailSender {

    private final JavaMailSender mailSender;

    // ✅ spring.mail.username 값을 가져와서 From 으로 사용
    @Value("${spring.mail.username}")
    private String from;

    @Async
    public void sendSimpleAsync(String to, String subject, String text) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

            helper.setFrom(from);   // ★ 반드시 설정해야 네이버 SMTP 인증 통과
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, false); // false = 일반 텍스트, true = HTML

            mailSender.send(message);
            log.info("[MAIL] sent to {}", to);
        } catch (Exception e) {
            log.error("[MAIL] send failed to {} - {}", to, e.toString());
        }
    }
}
