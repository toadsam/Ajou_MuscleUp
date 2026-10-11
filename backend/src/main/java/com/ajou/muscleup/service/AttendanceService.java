package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AdminAttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendancePublicShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceRankingItemResponse;
import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import org.springframework.data.domain.Page;
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

    /** 공개 공유 화면용(메모·신고 수·내부 id 제외). */
    AttendancePublicShareResponse getSharedBySlug(String slug);

    /** viewerKey: 로그인했으면 이메일, 아니면 IP. 같은 키·같은 글은 짧은 시간 안에 한 번만 센다. */
    AttendancePublicShareResponse addCheerBySlug(String slug, String viewerKey);

    /** 로그인 필수(email 이 없으면 401). 한 사람이 한 글에 한 번만 센다. */
    AttendancePublicShareResponse reportBySlug(String slug, String email);

    List<AttendanceRankingItemResponse> getWeeklyStreakRanking(int limit);

    List<AttendanceRankingItemResponse> getMonthlyMediaRanking(YearMonth month, int limit);

    List<AttendanceShareResponse> listSharedForAdmin(int limit);
    Page<AttendanceShareResponse> listSharedForAdmin(int page, int size);
    Page<AdminAttendanceLogResponse> listLogsForAdmin(
            int page,
            int size,
            String query,
            Boolean didWorkout,
            Boolean shared,
            LocalDate fromDate,
            LocalDate toDate
    );

    AttendanceShareResponse setHiddenByAdmin(Long attendanceId, boolean hidden);
}
