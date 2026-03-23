package com.ajou.muscleup.dto.crew;

import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewChallengeMemberProgressResponse {
    private Long userId;
    private String nickname;
    private long workoutDays;
    private int targetWorkoutDays;
    private double completionRate;
    private String badge;
    private CharacterTier characterTier;
    private Integer characterStage;
    private Integer characterLevel;
    private String avatarSeed;
    private Gender gender;
    @JsonProperty("isResting")
    private boolean isResting;
}
