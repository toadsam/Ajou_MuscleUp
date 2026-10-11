package com.ajou.muscleup.dto.ai;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.util.Map;

@Getter
public class AiInbodyReviewRequest {
    @Size(max = 60)
    private Map<String, String> metrics;
    @Size(max = 500)
    private String goal;
    @Size(max = 1000)
    private String notes;
    @Size(max = 30)
    private String goalIntensity;
    @Size(max = 20)
    private String gender;
    @Min(1) @Max(120)
    private Integer age;
    @Min(50) @Max(250)
    private Integer heightCm;
}
