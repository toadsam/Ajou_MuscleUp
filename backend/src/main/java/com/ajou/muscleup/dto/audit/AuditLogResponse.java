package com.ajou.muscleup.dto.audit;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AuditLogResponse {
    private Long id;
    private String action;
    private String resource;
    private String summary;
    private String metadata;
    private String userEmail;
    private String userNickname;
    private LocalDateTime createdAt;
}
