package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceRankingItemResponse;
import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
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

    AttendanceShareResponse shareByDate(String email, LocalDate date);

    void unshareByDate(String email, LocalDate date);

    AttendanceShareResponse getSharedBySlug(String slug);

    AttendanceShareResponse addCheerBySlug(String slug);

    AttendanceShareResponse reportBySlug(String slug);

    List<AttendanceRankingItemResponse> getWeeklyStreakRanking(int limit);

    List<AttendanceRankingItemResponse> getMonthlyMediaRanking(YearMonth month, int limit);

    List<AttendanceShareResponse> listSharedForAdmin(int limit);

    AttendanceShareResponse setHiddenByAdmin(Long attendanceId, boolean hidden);
}
