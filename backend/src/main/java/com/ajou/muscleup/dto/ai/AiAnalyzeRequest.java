package com.ajou.muscleup.dto.ai;

import lombok.Getter;

@Getter
public class AiAnalyzeRequest {
    private String height;     // cm
    private String weight;     // kg
    private String bodyFat;    // %
    private String muscleMass; // kg
    private String goal;       // optional free text
}

