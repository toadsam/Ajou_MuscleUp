package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.dto.character.CharacterPublicUpdateRequest;
import com.ajou.muscleup.dto.character.CharacterRestUpdateRequest;
import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;
import com.ajou.muscleup.service.CharacterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/character")
@RequiredArgsConstructor
public class CharacterController {
    private final CharacterService characterService;

    @GetMapping("/me")
    public ResponseEntity<CharacterProfileResponse> getMe(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(characterService.getOrCreateProfile(email));
    }

    @PostMapping("/evaluate")
    public ResponseEntity<StatsCharacterResponse> evaluate(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(characterService.evaluate(email, CharacterEvolutionTriggerType.MANUAL_EVALUATE));
    }

    @PutMapping("/me/public")
    public ResponseEntity<CharacterProfileResponse> updatePublic(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody CharacterPublicUpdateRequest request
    ) {
        return ResponseEntity.ok(characterService.updatePublic(email, request));
    }

    @PutMapping("/me/resting")
    public ResponseEntity<CharacterProfileResponse> updateResting(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody CharacterRestUpdateRequest request
    ) {
        return ResponseEntity.ok(characterService.updateResting(email, request));
    }

    @PostMapping("/reroll")
    public ResponseEntity<CharacterProfileResponse> reroll(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(characterService.reroll(email));
    }
}
