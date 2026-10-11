package com.ajou.muscleup.dto.ai;

import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class AiAnalyzeRequest {
    @Size(max = 20)
    private String height;     // cm
    @Size(max = 20)
    private String weight;     // kg
    @Size(max = 20)
    private String bodyFat;    // %
    @Size(max = 20)
    private String muscleMass; // kg
    @Size(max = 500)
    private String goal;       // optional free text
}

