package com.ajou.muscleup.dto.ai;

import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class AiPlanRequest {
    @Size(max = 100)
    private String experienceLevel;
    @Size(max = 100)
    private String availableDays;
    @Size(max = 200)
    private String focusArea;
    @Size(max = 300)
    private String equipment;
    @Size(max = 100)
    private String preferredTime;
    @Size(max = 1000)
    private String notes;
}
