package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceRankingItemResponse;
import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.service.AttendanceService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/attendance")
public class AttendanceController {
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final AttendanceService attendanceService;

    @PostMapping("/today")
    public ResponseEntity<AttendanceLogResponse> upsertToday(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody AttendanceUpsertRequest request
    ) {
        return ResponseEntity.ok(attendanceService.upsertToday(email, request));
    }

    @GetMapping
    public ResponseEntity<List<AttendanceLogResponse>> getMonthlyLogs(
            @AuthenticationPrincipal String email,
            @RequestParam String month
    ) {
        YearMonth parsed = parseMonthOrThrow(month);
        return ResponseEntity.ok(attendanceService.getMonthlyLogs(email, parsed));
    }

    @GetMapping("/summary")
    public ResponseEntity<AttendanceSummaryResponse> getSummary(
            @AuthenticationPrincipal String email,
            @RequestParam String month
    ) {
        YearMonth parsed = parseMonthOrThrow(month);
        return ResponseEntity.ok(attendanceService.getSummary(email, parsed));
    }

    @PutMapping("/{date}")
    public ResponseEntity<AttendanceLogResponse> upsertByDate(
            @AuthenticationPrincipal String email,
            @PathVariable String date,
            @Valid @RequestBody AttendanceUpsertRequest request
    ) {
        LocalDate parsed = parseDateOrThrow(date);
        return ResponseEntity.ok(attendanceService.upsertByDate(email, parsed, request));
    }

    @PostMapping("/{date}/share")
    public ResponseEntity<AttendanceShareResponse> shareByDate(
            @AuthenticationPrincipal String email,
            @PathVariable String date
    ) {
        LocalDate parsed = parseDateOrThrow(date);
        return ResponseEntity.ok(attendanceService.shareByDate(email, parsed));
    }

    @DeleteMapping("/{date}/share")
    public ResponseEntity<Void> unshareByDate(
            @AuthenticationPrincipal String email,
            @PathVariable String date
    ) {
        LocalDate parsed = parseDateOrThrow(date);
        attendanceService.unshareByDate(email, parsed);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/share/{slug}")
    public ResponseEntity<AttendanceShareResponse> getSharedBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(attendanceService.getSharedBySlug(slug));
    }

    @PostMapping("/share/{slug}/cheer")
    public ResponseEntity<AttendanceShareResponse> cheerBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(attendanceService.addCheerBySlug(slug));
    }

    @PostMapping("/share/{slug}/report")
    public ResponseEntity<AttendanceShareResponse> reportBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(attendanceService.reportBySlug(slug));
    }

    @GetMapping("/rankings/weekly-streak")
    public ResponseEntity<List<AttendanceRankingItemResponse>> weeklyStreakRanking(
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(attendanceService.getWeeklyStreakRanking(limit));
    }

    @GetMapping("/rankings/monthly-media")
    public ResponseEntity<List<AttendanceRankingItemResponse>> monthlyMediaRanking(
            @RequestParam String month,
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        YearMonth parsed = parseMonthOrThrow(month);
        return ResponseEntity.ok(attendanceService.getMonthlyMediaRanking(parsed, limit));
    }

    private YearMonth parseMonthOrThrow(String month) {
        if (month == null || month.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month format. Expected YYYY-MM");
        }
        try {
            return YearMonth.parse(month, MONTH_FORMAT);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month format. Expected YYYY-MM");
        }
    }

    private LocalDate parseDateOrThrow(String date) {
        if (date == null || date.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format. Expected YYYY-MM-DD");
        }
        try {
            return LocalDate.parse(date, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format. Expected YYYY-MM-DD");
        }
    }
}
