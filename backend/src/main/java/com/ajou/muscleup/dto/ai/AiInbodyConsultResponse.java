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
    private int confidence;
    private boolean reviewRequired;
    private List<String> warnings;
    private String sourceType;
}
