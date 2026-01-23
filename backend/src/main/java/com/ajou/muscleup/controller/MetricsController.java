package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.metrics.LobbyMetricsResponse;
import com.ajou.muscleup.service.MetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/metrics")
@RequiredArgsConstructor
public class MetricsController {
    private final MetricsService metricsService;

    @GetMapping("/lobby")
    public ResponseEntity<LobbyMetricsResponse> getLobbyMetrics() {
        return ResponseEntity.ok(metricsService.getLobbyMetrics());
    }
}
