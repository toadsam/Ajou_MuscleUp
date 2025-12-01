package com.ajou.muscleup.dto.ai;

import lombok.Getter;

@Getter
public class AiPlanRequest {
    private String experienceLevel;
    private String availableDays;
    private String focusArea;
    private String equipment;
    private String preferredTime;
    private String notes;
}
