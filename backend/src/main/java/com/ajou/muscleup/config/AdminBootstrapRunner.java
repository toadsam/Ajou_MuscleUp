package com.ajou.muscleup.config;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrapRunner implements ApplicationRunner {

    private final UserRepository userRepository;

    @Value("${app.admin.bootstrap-email:}")
    private String bootstrapEmail;

    @Override
    @Transactional
    public void run(org.springframework.boot.ApplicationArguments args) {
        String email = normalizeEmail(bootstrapEmail);
        if (email.isEmpty()) {
            return;
        }

        userRepository.findByEmail(email).ifPresent(user -> promoteToAdminIfNeeded(user, email));
    }

    private void promoteToAdminIfNeeded(User user, String email) {
        String role = user.getRole() == null ? "" : user.getRole().trim().toUpperCase(Locale.ROOT);
        if ("ADMIN".equals(role) || "ROLE_ADMIN".equals(role)) {
            return;
        }

        user.setRole("ROLE_ADMIN");
        userRepository.save(user);
        log.info("Bootstrapped admin role for {}", email);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
