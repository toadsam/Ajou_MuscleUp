package com.ajou.muscleup.dto.attendance;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Getter;

@Getter
public class AttendanceUpsertRequest {
    @NotNull
    private Boolean didWorkout;

    @Size(max = 200)
    private String memo;

    @Size(max = 3)
    private List<String> workoutTypes;

    @Size(max = 16)
    private String workoutIntensity;
}
