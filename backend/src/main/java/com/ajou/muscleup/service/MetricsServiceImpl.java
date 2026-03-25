package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.metrics.LobbyMetricsResponse;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.LoungeVisitLogRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MetricsServiceImpl implements MetricsService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final AttendanceLogRepository attendanceLogRepository;
    private final LoungeVisitLogRepository loungeVisitLogRepository;
    private final UserBodyStatsRepository userBodyStatsRepository;

    @Override
    @Transactional(readOnly = true)
    public LobbyMetricsResponse getLobbyMetrics() {
        LocalDate today = LocalDate.now(KST);
        long loungeVisitCount = loungeVisitLogRepository.count();
        long todayAttendanceCount = attendanceLogRepository.countByDate(today);
        double totalThreeLiftKg = userBodyStatsRepository.sumThreeLiftTotal();

        return LobbyMetricsResponse.builder()
                .loungeVisitCount(loungeVisitCount)
                .todayAttendanceCount(todayAttendanceCount)
                .totalThreeLiftKg(totalThreeLiftKg)
                .build();
    }
}
