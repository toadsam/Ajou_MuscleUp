package com.ajou.muscleup.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@AllArgsConstructor
public class AiInbodyConsultResponse {
    private String consultation;
    private Map<String, String> metrics;
    private Map<String, String> targets;
    private Map<String, String> dailyNutrition;
    private Map<String, String> structuredReport;
    private List<Map<String, String>> weeklyCheckpoints;
    private String goalSource;
    private int confidence;
    private boolean reviewRequired;
    private List<String> warnings;
    private String sourceType;
}
