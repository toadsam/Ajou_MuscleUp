package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.analytics.AnalyticsSummaryResponse;
import com.ajou.muscleup.repository.AiChatMessageRepository;
import com.ajou.muscleup.repository.BragCommentRepository;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.ProgramApplicationRepository;
import com.ajou.muscleup.repository.ReviewRepository;
import com.ajou.muscleup.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

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
    public ResponseEntity<?> listProgramApplications() {
        return ResponseEntity.ok(programApplicationRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(com.ajou.muscleup.dto.program.ApplicationResponse::from).toList());
    }

    @PatchMapping("/programs/applications/{id}/status")
    public ResponseEntity<?> updateProgramApplicationStatus(@PathVariable("id") Long id,
                                                            @RequestParam("status") com.ajou.muscleup.entity.ApplicationStatus status) {
        var app = programApplicationRepository.findById(id).orElse(null);
        if (app == null) {
            return ResponseEntity.notFound().build();
        }
        app.setStatus(status);
        programApplicationRepository.save(app);
        return ResponseEntity.ok(com.ajou.muscleup.dto.program.ApplicationResponse.from(app));
    }
}
