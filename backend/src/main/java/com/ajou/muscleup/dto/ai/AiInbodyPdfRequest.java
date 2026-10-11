package com.ajou.muscleup.dto.ai;

import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class AiInbodyPdfRequest {
    @Size(max = 100)
    private String memberName;
    @Size(max = 20000)
    private String consultation;
    @Size(max = 60)
    private Map<String, String> metrics;
    @Size(max = 60)
    private Map<String, String> targets;
    @Size(max = 60)
    private Map<String, String> dailyNutrition;
    @Size(max = 26)
    private List<Map<String, String>> weeklyCheckpoints;
    @Size(max = 50)
    private List<String> warnings;
    @Size(max = 50)
    private String goalSource;
    private Integer confidence;
    @Size(max = 50)
    private String sourceType;
}
