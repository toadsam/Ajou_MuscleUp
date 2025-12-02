package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.analytics.AnalyticsEventRequest;
import com.ajou.muscleup.service.AnalyticsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @PostMapping("/events")
    public ResponseEntity<Void> record(@AuthenticationPrincipal String email,
                                       @Valid @RequestBody AnalyticsEventRequest req) {
        analyticsService.recordEvent(email, req);
        return ResponseEntity.accepted().build();
    }
}
