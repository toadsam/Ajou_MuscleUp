package com.ajou.muscleup.dto.ai;

import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class AiInbodyPdfRequest {
    private String memberName;
    private String consultation;
    private Map<String, String> metrics;
    private Map<String, String> targets;
    private Map<String, String> dailyNutrition;
    private List<Map<String, String>> weeklyCheckpoints;
    private List<String> warnings;
    private String goalSource;
    private Integer confidence;
    private String sourceType;
}
