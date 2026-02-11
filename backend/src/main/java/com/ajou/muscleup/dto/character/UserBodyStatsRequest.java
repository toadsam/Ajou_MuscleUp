package com.ajou.muscleup.dto.character;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import com.ajou.muscleup.entity.Gender;
import lombok.Getter;

@Getter
public class UserBodyStatsRequest {
    @Min(50)
    @Max(250)
    private Integer heightCm;

    private Gender gender;

    @NotNull
    @DecimalMin(value = "20.0")
    @DecimalMax(value = "300.0")
    private Double weightKg;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "150.0")
    private Double skeletalMuscleKg;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "70.0")
    private Double bodyFatPercent;

    @Pattern(regexp = "^[EI][NS][TF][JP]$", message = "MBTI must be a valid 4-letter type")
    private String mbti;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "500.0")
    private Double benchKg;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "500.0")
    private Double squatKg;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "500.0")
    private Double deadliftKg;
}
