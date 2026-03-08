package com.ajou.muscleup.dto.crew;

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
}
