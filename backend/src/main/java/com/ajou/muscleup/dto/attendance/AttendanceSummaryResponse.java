package com.ajou.muscleup.dto.attendance;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AttendanceSummaryResponse {
    private long monthWorkoutCount;
    private int currentStreak;
    private Integer bestStreakInMonth;
}
