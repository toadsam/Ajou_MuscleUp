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

    @Size(max = 280)
    private String shareComment;

    @Size(max = 3)
    private List<String> workoutTypes;

    @Size(max = 16)
    private String workoutIntensity;

    @Size(max = 10)
    private List<String> mediaUrls;

    /** 운동 세션을 끝내며 출석할 때(WorkoutSessionService) */
    public static AttendanceUpsertRequest workout(List<String> workoutTypes, String memo) {
        AttendanceUpsertRequest r = new AttendanceUpsertRequest();
        r.didWorkout = true;
        r.workoutTypes = workoutTypes;
        r.memo = memo;
        return r;
    }
}
