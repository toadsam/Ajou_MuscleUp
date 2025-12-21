package com.ajou.muscleup.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AnalyticsEventResponse {
    private Long id;
    private String page;
    private String action;
    private String metadata;
    private String userEmail;
    private String userNickname;
    private LocalDateTime createdAt;
}
