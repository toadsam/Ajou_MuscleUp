package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.analytics.AnalyticsSummaryResponse;
import com.ajou.muscleup.dto.support.AdminInquiryResponse;
import com.ajou.muscleup.dto.support.AdminInquiryStatusUpdateRequest;
import com.ajou.muscleup.entity.ApplicationStatus;
import com.ajou.muscleup.entity.InquiryStatus;
import com.ajou.muscleup.repository.AiChatMessageRepository;
import com.ajou.muscleup.repository.BragCommentRepository;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.ProgramApplicationRepository;
import com.ajou.muscleup.repository.ReviewRepository;
import com.ajou.muscleup.repository.InquiryRepository;
import com.ajou.muscleup.service.AnalyticsService;
import com.ajou.muscleup.service.AttendanceService;
import com.ajou.muscleup.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.Getter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import jakarta.validation.Valid;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AnalyticsService analyticsService;
    private final BragPostRepository bragPostRepository;
    private final BragCommentRepository bragCommentRepository;
    private final BragLikeRepository bragLikeRepository;
    private final ReviewRepository reviewRepository;
    private final AiChatMessageRepository aiChatMessageRepository;
    private final ProgramApplicationRepository programApplicationRepository;
    private final InquiryRepository inquiryRepository;
    private final AuditLogService auditLogService;
    private final AttendanceService attendanceService;

    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping("/analytics/summary")
    public ResponseEntity<AnalyticsSummaryResponse> summary(
            @RequestParam(value = "days", defaultValue = "30") int days
    ) {
        LocalDateTime since = LocalDateTime.now().minusDays(Math.max(1, days));
        return ResponseEntity.ok(analyticsService.summarySince(since));
    }

    @GetMapping("/analytics/events")
    public ResponseEntity<List<com.ajou.muscleup.dto.analytics.AnalyticsEventResponse>> recentEvents(
            @RequestParam(value = "limit", defaultValue = "200") int limit
    ) {
        return ResponseEntity.ok(analyticsService.recentEvents(limit));
    }

    @GetMapping("/audit")
    public ResponseEntity<List<com.ajou.muscleup.dto.audit.AuditLogResponse>> audit(
            @RequestParam(value = "limit", defaultValue = "200") int limit
    ) {
        return ResponseEntity.ok(auditLogService.recent(limit));
    }

    @DeleteMapping("/brags/{id}")
    public ResponseEntity<Void> forceDeleteBrag(@PathVariable("id") Long id) {
        bragCommentRepository.deleteByBragPost_Id(id);
        bragLikeRepository.deleteByBragPost_Id(id);
        bragPostRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/brags/comments/{id}")
    public ResponseEntity<Void> forceDeleteComment(@PathVariable("id") Long id) {
        bragCommentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<Void> forceDeleteReview(@PathVariable("id") Long id) {
        reviewRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/ai/history/{id}")
    public ResponseEntity<Void> forceDeleteAiHistory(@PathVariable("id") Long id) {
        aiChatMessageRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/programs/applications")
    public ResponseEntity<Page<com.ajou.muscleup.dto.program.ApplicationResponse>> listProgramApplications(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        return ResponseEntity.ok(
                programApplicationRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(safePage, safeSize))
                        .map(com.ajou.muscleup.dto.program.ApplicationResponse::from)
        );
    }

    @PatchMapping("/programs/applications/{id}/status")
    public ResponseEntity<?> updateProgramApplicationStatus(@PathVariable("id") Long id,
                                                            @RequestParam("status") ApplicationStatus status) {
        var app = programApplicationRepository.findById(id).orElse(null);
        if (app == null) {
            return ResponseEntity.notFound().build();
        }
        app.setStatus(status);
        programApplicationRepository.save(app);
        return ResponseEntity.ok(com.ajou.muscleup.dto.program.ApplicationResponse.from(app));
    }

    @GetMapping("/attendance/shares")
    public ResponseEntity<Page<com.ajou.muscleup.dto.attendance.AttendanceShareResponse>> listAttendanceShares(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(attendanceService.listSharedForAdmin(page, size));
    }

    @GetMapping("/attendance/logs")
    public ResponseEntity<Page<com.ajou.muscleup.dto.attendance.AdminAttendanceLogResponse>> listAttendanceLogs(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "didWorkout", required = false) Boolean didWorkout,
            @RequestParam(value = "shared", required = false) Boolean shared,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(attendanceService.listLogsForAdmin(page, size, query, didWorkout, shared, from, to));
    }

    @GetMapping("/support/inquiries")
    public ResponseEntity<Page<AdminInquiryResponse>> listSupportInquiries(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "chairmanOnly", defaultValue = "false") boolean chairmanOnly,
            @RequestParam(value = "status", required = false) InquiryStatus status
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        String normalizedQuery = query == null ? null : query.trim();
        if (normalizedQuery != null && normalizedQuery.isEmpty()) {
            normalizedQuery = null;
        }
        return ResponseEntity.ok(
                inquiryRepository
                        .searchForAdmin(normalizedQuery, chairmanOnly, status, PageRequest.of(safePage, safeSize))
                        .map(AdminInquiryResponse::from)
        );
    }

    @PatchMapping("/support/inquiries/{id}/status")
    public ResponseEntity<AdminInquiryResponse> updateSupportInquiryStatus(
            @PathVariable("id") Long id,
            @Valid @RequestBody AdminInquiryStatusUpdateRequest request
    ) {
        var inquiry = inquiryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inquiry not found"));
        inquiry.setStatus(request.getStatus());
        String nextNote = request.getAdminNote() == null ? null : request.getAdminNote().trim();
        if (nextNote != null && nextNote.isEmpty()) {
            nextNote = null;
        }
        inquiry.setAdminNote(nextNote);
        inquiry.setHandledAt(LocalDateTime.now());
        var saved = inquiryRepository.save(inquiry);
        return ResponseEntity.ok(AdminInquiryResponse.from(saved));
    }

    @PatchMapping("/attendance/shares/{id}/hidden")
    public ResponseEntity<com.ajou.muscleup.dto.attendance.AttendanceShareResponse> setAttendanceShareHidden(
            @PathVariable("id") Long id,
            @RequestParam("hidden") boolean hidden
    ) {
        return ResponseEntity.ok(attendanceService.setHiddenByAdmin(id, hidden));
    }

    @PostMapping("/audit/manual")
    public ResponseEntity<Void> manualAudit(
            @AuthenticationPrincipal String email,
            @RequestBody ManualAuditRequest request
    ) {
        auditLogService.log(
                email,
                request.getAction() != null ? request.getAction() : "ADMIN_ACTION",
                request.getResource() != null ? request.getResource() : "admin",
                request.getSummary(),
                request.getMetadata()
        );
        return ResponseEntity.ok().build();
    }

    @Getter
    static class ManualAuditRequest {
        private String action;
        private String resource;
        private String summary;
        private String metadata;
    }
}
