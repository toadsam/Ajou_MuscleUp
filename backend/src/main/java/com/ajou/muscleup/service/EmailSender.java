// src/main/java/com/ajou/muscleup/service/EmailSender.java
package com.ajou.muscleup.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmailSender {

    private final JavaMailSender mailSender;

    @Async
    public void sendSimpleAsync(String from, String to, String subject, String text) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);    // 네이버: From == 계정 메일
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(text);
            mailSender.send(msg);
            log.info("[MAIL] sent to {}", to);
        } catch (Exception e) {
            // 실패해도 회원가입 플로우는 막지 않고, 서버 로그로만 남김
            log.error("[MAIL] send failed to {} - {}", to, e.toString());
        }
    }
}
