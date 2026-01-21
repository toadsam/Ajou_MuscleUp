package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.character.CharacterRankingListResponse;
import com.ajou.muscleup.service.RankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rankings")
@RequiredArgsConstructor
public class RankingController {
    private final RankingService rankingService;

    @GetMapping("/characters")
    public ResponseEntity<CharacterRankingListResponse> characters(
            @AuthenticationPrincipal String email,
            @RequestParam(defaultValue = "LEVEL") String type,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(rankingService.getCharacterRankings(email, type, limit));
    }
}
