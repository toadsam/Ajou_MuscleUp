package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterTier;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterEvaluationResponse {
    private double threeLiftTotal;
    private double strengthRatio;
    private double totalScore;
    private int level;
    private CharacterTier tier;
    private int evolutionStage;
    private String title;
}
