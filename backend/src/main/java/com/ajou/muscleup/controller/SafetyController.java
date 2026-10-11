package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.ContentReport;
import com.ajou.muscleup.entity.ReportReason;
import com.ajou.muscleup.entity.ReportStatus;
import com.ajou.muscleup.entity.ReportTargetType;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.BlockService;
import com.ajou.muscleup.service.ReportService;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 신고 · 차단(0단계 PR 8, 이용약관 제10조).
 *   POST   /api/reports                    신고 { targetType, targetId, reason, detail }
 *   GET    /api/blocks                     내가 차단한 사람
 *   POST   /api/blocks { userId }          차단
 *   DELETE /api/blocks/{userId}            차단 풀기
 *   GET    /api/admin/reports?status=      신고 목록(운영자)
 *   PATCH  /api/admin/reports/{id}         처리 { status: ACTIONED|DISMISSED, deleteContent, note }
 */
@RestController
@RequiredArgsConstructor
@Validated
public class SafetyController {
    private final ReportService reportService;
    private final BlockService blockService;
    private final UserRepository userRepository;

    public record ReportRequest(ReportTargetType targetType, Long targetId, ReportReason reason, @Size(max = 500) String detail) {}

    public record BlockRequest(Long userId) {}

    public record ResolveRequest(ReportStatus status, boolean deleteContent, @Size(max = 500) String note) {}

    public record ReportResponse(
            Long id, ReportTargetType targetType, Long targetId, ReportReason reason, String detail, String snapshot,
            ReportStatus status, String reporterNickname, Long targetUserId, String targetUserNickname,
            String adminNote, LocalDateTime createdAt, LocalDateTime handledAt
    ) {
        static ReportResponse from(ContentReport r) {
            return new ReportResponse(r.getId(), r.getTargetType(), r.getTargetId(), r.getReason(), r.getDetail(), r.getSnapshot(),
                    r.getStatus(), r.getReporter() != null ? r.getReporter().getNickname() : null,
                    r.getTargetUser() != null ? r.getTargetUser().getId() : null,
                    r.getTargetUser() != null ? r.getTargetUser().getNickname() : null,
                    r.getAdminNote(), r.getCreatedAt(), r.getHandledAt());
        }
    }

    @PostMapping("/api/reports")
    public ResponseEntity<Map<String, Object>> report(@AuthenticationPrincipal String email, @RequestBody ReportRequest req) {
        ContentReport saved = reportService.create(me(email), req.targetType(), req.targetId(), req.reason(), req.detail());
        // 신고한 사람에게는 접수 사실만 돌려준다(대상 작성자 정보는 주지 않음)
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", saved.getId(), "status", saved.getStatus()));
    }

    @GetMapping("/api/blocks")
    public List<BlockService.BlockedUser> blocks(@AuthenticationPrincipal String email) {
        return blockService.list(me(email));
    }

    @PostMapping("/api/blocks")
    public ResponseEntity<Void> block(@AuthenticationPrincipal String email, @RequestBody BlockRequest req) {
        blockService.block(me(email), req == null ? null : req.userId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/blocks/{userId}")
    public ResponseEntity<Void> unblock(@AuthenticationPrincipal String email, @PathVariable Long userId) {
        blockService.unblock(me(email), userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/admin/reports")
    public Page<ReportResponse> adminList(@RequestParam(required = false) ReportStatus status,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return reportService.list(status, PageRequest.of(Math.max(page, 0), Math.max(1, Math.min(size, 50))))
                .map(ReportResponse::from);
    }

    @PatchMapping("/api/admin/reports/{id}")
    public ReportResponse adminResolve(@PathVariable Long id, @RequestBody ResolveRequest req) {
        return ReportResponse.from(reportService.resolve(id, req.status(), req.deleteContent(), req.note()));
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
