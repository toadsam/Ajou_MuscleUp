package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.entity.Gender;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserBodyStatsResponse {
    private Integer heightCm;
    private Gender gender;
    private Double weightKg;
    private Double skeletalMuscleKg;
    private Double bodyFatPercent;
    private String mbti;
    private Double benchKg;
    private Double squatKg;
    private Double deadliftKg;
    private LocalDateTime updatedAt;

    public static UserBodyStatsResponse from(UserBodyStats stats) {
        return UserBodyStatsResponse.builder()
                .heightCm(stats.getHeightCm())
                .gender(stats.getGender())
                .weightKg(stats.getWeightKg())
                .skeletalMuscleKg(stats.getSkeletalMuscleKg())
                .bodyFatPercent(stats.getBodyFatPercent())
                .mbti(stats.getMbti())
                .benchKg(stats.getBenchKg())
                .squatKg(stats.getSquatKg())
                .deadliftKg(stats.getDeadliftKg())
                .updatedAt(stats.getUpdatedAt())
                .build();
    }
}
