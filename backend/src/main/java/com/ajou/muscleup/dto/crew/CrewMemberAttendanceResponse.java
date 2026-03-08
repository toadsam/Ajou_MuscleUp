package com.ajou.muscleup.dto.crew;

import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewMemberAttendanceResponse {
    private Long userId;
    private String nickname;
    private WorkoutCrewMemberRole role;
    private long workoutDays;
    private int targetDays;
    private double attendanceRate;
}
