package com.ajou.muscleup;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@SpringBootApplication(scanBasePackages = "com.ajou.muscleup")
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }

    @Autowired
    private JavaMailSenderImpl mailSender;

    @Value("${mail.test-on-startup:false}")
    private boolean mailTestOnStartup;

    @EventListener(ApplicationReadyEvent.class)
    public void testMailConnection() {
        if (!mailTestOnStartup) {
            return;
        }

        try {
            mailSender.testConnection();
            System.out.println("SMTP connection success");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}