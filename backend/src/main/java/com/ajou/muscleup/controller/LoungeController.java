package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.lounge.LoungeProfileResponse;
import com.ajou.muscleup.service.LoungeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lounge")
@RequiredArgsConstructor
public class LoungeController {
    private final LoungeService loungeService;

    @GetMapping("/profile")
    public ResponseEntity<LoungeProfileResponse> getProfile(
            @AuthenticationPrincipal String email
    ) {
        return ResponseEntity.ok(loungeService.getProfile(email));
    }
}
