package com.ajou.muscleup;

import org.springframework.beans.factory.annotation.Autowired;
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
private JavaMailSenderImpl mailSender;  // ✅ 구현체로 변경

@EventListener(ApplicationReadyEvent.class)
public void testMailConnection() {
    try {
        mailSender.testConnection();
        System.out.println("✅ SMTP 연결 성공");
    } catch (Exception e) {
        e.printStackTrace();
    }
}

}
