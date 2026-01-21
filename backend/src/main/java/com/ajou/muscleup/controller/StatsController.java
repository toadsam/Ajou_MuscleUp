package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.dto.character.UserBodyStatsRequest;
import com.ajou.muscleup.dto.character.UserBodyStatsResponse;
import com.ajou.muscleup.service.StatsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mypage/stats")
@RequiredArgsConstructor
public class StatsController {
    private final StatsService statsService;

    @GetMapping
    public ResponseEntity<UserBodyStatsResponse> get(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(statsService.getStats(email));
    }

    @PutMapping
    public ResponseEntity<StatsCharacterResponse> upsert(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody UserBodyStatsRequest request
    ) {
        return ResponseEntity.ok(statsService.upsertStats(email, request));
    }
}
