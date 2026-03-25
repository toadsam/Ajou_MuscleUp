package com.ajou.muscleup.dto.crew;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewCompetitionEntryResponse {
    private int rank;
    private Long userId;
    private String nickname;
    private double score;
    private double attendanceScore;
    private double challengeScore;
    private double recentScore;
    private double bonusScore;
    private double attendanceRate;
    private long recentWorkoutDays;
    private double challengeAverageCompletion;
}
