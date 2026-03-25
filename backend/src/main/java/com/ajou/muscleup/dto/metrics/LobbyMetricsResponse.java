package com.ajou.muscleup.dto.metrics;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LobbyMetricsResponse {
    private long loungeVisitCount;
    private long todayAttendanceCount;
    private double totalThreeLiftKg;
}
