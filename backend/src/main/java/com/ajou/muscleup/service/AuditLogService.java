package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.audit.AuditLogResponse;
import com.ajou.muscleup.entity.AuditLog;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AuditLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional
    public void log(String email, String action, String resource, String summary, String metadata) {
        User user = null;
        if (email != null && !email.isBlank()) {
            user = userRepository.findByEmail(email).orElse(null);
        }
        AuditLog log = AuditLog.builder()
                .user(user)
                .action(action)
                .resource(resource)
                .summary(summary)
                .metadata(metadata)
                .build();
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> recent(int limit) {
        int size = Math.max(1, Math.min(limit, 500));
        return auditLogRepository.findAll(PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(l -> new AuditLogResponse(
                        l.getId(),
                        l.getAction(),
                        l.getResource(),
                        l.getSummary(),
                        l.getMetadata(),
                        l.getUser() != null ? l.getUser().getEmail() : null,
                        l.getUser() != null ? l.getUser().getNickname() : null,
                        l.getCreatedAt()
                ))
                .toList();
    }

    @Scheduled(cron = "0 0 4 * * *")
    @Transactional
    public void purgeOldLogs() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(5);
        auditLogRepository.deleteOlderThan(cutoff);
    }
}
