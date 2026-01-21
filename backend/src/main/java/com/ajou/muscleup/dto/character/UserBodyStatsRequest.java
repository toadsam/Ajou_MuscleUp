package com.ajou.muscleup.dto.character;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class UserBodyStatsRequest {
    @Min(50)
    @Max(250)
    private Integer heightCm;

    @NotNull
    @DecimalMin(value = "20.0")
    @DecimalMax(value = "300.0")
    private Double weightKg;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "150.0")
    private Double skeletalMuscleKg;

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
