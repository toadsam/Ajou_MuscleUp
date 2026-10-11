package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendancePublicShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceRankingItemResponse;
import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.service.AttendanceService;
import jakarta.servlet.http.HttpServletRequest;
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

    // 공개 화면용 응답(메모·신고 수·내부 id 없음). 작성자용 전체 응답은 POST /{date}/share 가 준다.
    @GetMapping("/share/{slug}")
    public ResponseEntity<AttendancePublicShareResponse> getSharedBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(attendanceService.getSharedBySlug(slug));
    }

    // 로그인 없이도 누를 수 있다. 같은 사람(이메일 또는 IP)·같은 글은 10분에 한 번만 센다.
    @PostMapping("/share/{slug}/cheer")
    public ResponseEntity<AttendancePublicShareResponse> cheerBySlug(
            @AuthenticationPrincipal String email,
            @PathVariable String slug,
            HttpServletRequest httpRequest
    ) {
        String viewerKey = isLoggedIn(email) ? "user:" + email : "ip:" + clientIp(httpRequest);
        return ResponseEntity.ok(attendanceService.addCheerBySlug(slug, viewerKey));
    }

    // 신고는 로그인 필수(경로 자체는 SecurityConfig 에서 permitAll 이라 여기서 401 을 낸다). 1인 1회.
    @PostMapping("/share/{slug}/report")
    public ResponseEntity<AttendancePublicShareResponse> reportBySlug(
            @AuthenticationPrincipal String email,
            @PathVariable String slug
    ) {
        if (!isLoggedIn(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "신고는 로그인한 뒤에 할 수 있어요.");
        }
        return ResponseEntity.ok(attendanceService.reportBySlug(slug, email));
    }

    // permitAll 경로에서 로그인하지 않은 요청은 principal 이 null 이거나 "anonymousUser" 문자열이다.
    private boolean isLoggedIn(String email) {
        return email != null && !email.isBlank() && !"anonymousUser".equals(email);
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

    /**
     * 응원 중복 방지용 IP. 배포 환경은 프록시 뒤라 remoteAddr 가 프록시 주소일 수 있어
     * X-Forwarded-For 의 첫 값을 먼저 본다(위조 가능 — 응원 수 정도의 가벼운 중복 방지에만 쓴다).
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        return request.getRemoteAddr();
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
