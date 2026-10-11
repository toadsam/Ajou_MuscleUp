package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.gym.GymCreateRequest;
import com.ajou.muscleup.dto.gym.GymMemberResponse;
import com.ajou.muscleup.dto.gym.GymMemberRoleRequest;
import com.ajou.muscleup.dto.gym.GymSummaryResponse;
import com.ajou.muscleup.dto.gym.GymUpdateRequest;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.service.GymService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 짐(모임) API. 찾기 · 짐 정보 · 운영진 소개는 로그인 없이도(SecurityConfig), 나머지는 로그인 필요.
 * 설계: docs/design/stage0-gyms.md §6
 */
@RestController
@RequestMapping("/api/gyms")
@RequiredArgsConstructor
public class GymController {
    private final GymService gymService;

    @GetMapping
    public List<GymSummaryResponse> search(
            @AuthenticationPrincipal String email,
            @RequestParam(required = false) GymType type,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String school
    ) {
        return gymService.search(email, type, q, school);
    }

    @GetMapping("/mine")
    public List<GymSummaryResponse> mine(@AuthenticationPrincipal String email) {
        return gymService.mine(email);
    }

    @GetMapping("/{slug}")
    public GymSummaryResponse get(@AuthenticationPrincipal String email, @PathVariable String slug) {
        return gymService.get(email, slug);
    }

    /** ?role=STAFF 면 모임장 · 운영진만(누구나), 아니면 전체 멤버(멤버만) */
    @GetMapping("/{slug}/members")
    public List<GymMemberResponse> members(
            @AuthenticationPrincipal String email,
            @PathVariable String slug,
            @RequestParam(required = false) String role
    ) {
        return gymService.members(email, slug, "STAFF".equalsIgnoreCase(role));
    }

    @PostMapping
    public ResponseEntity<GymSummaryResponse> create(@AuthenticationPrincipal String email, @Valid @RequestBody GymCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gymService.create(email, request));
    }

    @PatchMapping("/{slug}")
    public GymSummaryResponse update(
            @AuthenticationPrincipal String email,
            @PathVariable String slug,
            @Valid @RequestBody GymUpdateRequest request
    ) {
        return gymService.update(email, slug, request);
    }

    @PatchMapping("/{slug}/members/{userId}")
    public GymMemberResponse setMemberRole(
            @AuthenticationPrincipal String email,
            @PathVariable String slug,
            @PathVariable Long userId,
            @Valid @RequestBody GymMemberRoleRequest request
    ) {
        return gymService.setMemberRole(email, slug, userId, request);
    }
}
