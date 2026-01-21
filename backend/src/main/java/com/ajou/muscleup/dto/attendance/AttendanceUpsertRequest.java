package com.ajou.muscleup.dto.attendance;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class AttendanceUpsertRequest {
    @NotNull
    private Boolean didWorkout;

    @Size(max = 200)
    private String memo;
}
