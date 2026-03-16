package com.ajou.muscleup.dto.ai;

import lombok.Getter;

import java.util.Map;

@Getter
public class AiInbodyReviewRequest {
    private Map<String, String> metrics;
    private String goal;
    private String notes;
    private String goalIntensity;
}
