package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.protein.ProteinShareApplicationResponse;
import com.ajou.muscleup.dto.protein.ProteinShareMessageRequest;
import com.ajou.muscleup.dto.protein.ProteinShareMessageResponse;
import com.ajou.muscleup.dto.protein.ProteinShareSummaryResponse;
import com.ajou.muscleup.entity.ProteinShareStatus;
import com.ajou.muscleup.service.ProteinShareService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/proteins/{proteinId}")
@RequiredArgsConstructor
public class ProteinShareController {
    private final ProteinShareService proteinShareService;

    @PostMapping("/applications")
    public ResponseEntity<ProteinShareApplicationResponse> apply(@PathVariable Long proteinId,
                                                                 @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(proteinShareService.apply(proteinId, email));
    }

    @GetMapping("/applications/me")
    public ResponseEntity<ProteinShareApplicationResponse> myApplication(@PathVariable Long proteinId,
                                                                         @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(proteinShareService.getMyApplication(proteinId, email));
    }

    @GetMapping("/applications")
    public ResponseEntity<List<ProteinShareApplicationResponse>> listApplications(@PathVariable Long proteinId,
                                                                                  @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(proteinShareService.listApplications(proteinId, email));
    }

    @PatchMapping("/applications/{appId}")
    public ResponseEntity<ProteinShareApplicationResponse> updateStatus(@PathVariable Long proteinId,
                                                                        @PathVariable Long appId,
                                                                        @RequestParam("status") ProteinShareStatus status,
                                                                        @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(proteinShareService.updateStatus(proteinId, appId, status, email));
    }

    @GetMapping("/applications/summary")
    public ResponseEntity<ProteinShareSummaryResponse> summary(@PathVariable Long proteinId) {
        return ResponseEntity.ok(proteinShareService.getSummary(proteinId));
    }

    @GetMapping("/chat/messages")
    public ResponseEntity<List<ProteinShareMessageResponse>> listMessages(@PathVariable Long proteinId,
                                                                          @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(proteinShareService.listMessages(proteinId, email));
    }

    @PostMapping("/chat/messages")
    public ResponseEntity<ProteinShareMessageResponse> postMessage(@PathVariable Long proteinId,
                                                                   @AuthenticationPrincipal String email,
                                                                   @Valid @RequestBody ProteinShareMessageRequest req) {
        return ResponseEntity.ok(proteinShareService.postMessage(proteinId, email, req.getContent()));
    }
}
