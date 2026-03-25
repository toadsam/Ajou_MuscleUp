package com.ajou.muscleup.dto.crew;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CrewChallengeCreateRequest {
    @NotBlank
    @Size(max = 80)
    private String title;

    @Size(max = 300)
    private String description;

    @NotNull
    private LocalDate startDate;

    @NotNull
    private LocalDate endDate;

    @Min(1)
    @Max(31)
    private int targetWorkoutDays;
}
