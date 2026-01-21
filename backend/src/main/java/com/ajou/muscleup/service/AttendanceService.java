package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

public interface AttendanceService {
    AttendanceLogResponse upsertToday(String email, AttendanceUpsertRequest request);

    AttendanceLogResponse upsertByDate(String email, LocalDate date, AttendanceUpsertRequest request);

    List<AttendanceLogResponse> getMonthlyLogs(String email, YearMonth month);

    AttendanceSummaryResponse getSummary(String email, YearMonth month);
}
