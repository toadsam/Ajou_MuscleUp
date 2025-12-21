package com.ajou.muscleup.dto.analytics;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class AnalyticsEventRequest {
    @NotBlank
    private String page;

    @NotBlank
    private String action;

    private String metadata;
}
