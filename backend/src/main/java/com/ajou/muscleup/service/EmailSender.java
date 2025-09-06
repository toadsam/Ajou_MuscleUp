// src/main/java/com/ajou/muscleup/service/EmailSender.java
package com.ajou.muscleup.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
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

    @Async
public void sendSimpleAsync(String to, String subject, String text) {
    try {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");

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
