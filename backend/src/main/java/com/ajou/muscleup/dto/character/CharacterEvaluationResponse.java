package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterTier;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterEvaluationResponse {
    private double threeLiftTotal;
    private double strengthRatio;
    private double bmi;
    private double skeletalMuscleIndex;
    private double heightWeightScore;
    private double heightMuscleScore;
    private double totalScore;
    private int level;
    private CharacterTier tier;
    private int evolutionStage;
    private String title;
}
