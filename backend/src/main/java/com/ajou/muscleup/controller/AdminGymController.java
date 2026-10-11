package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.gym.GymSummaryResponse;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.service.GymService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 앱 운영자: 짐 만들기 신청 승인 · 보관(/api/admin/** 는 ADMIN 만, SecurityConfig). */
@RestController
@RequestMapping("/api/admin/gyms")
@RequiredArgsConstructor
public class AdminGymController {
    private final GymService gymService;

    @GetMapping
    public List<GymSummaryResponse> list(
            @AuthenticationPrincipal String email,
            @RequestParam(defaultValue = "PENDING") GymStatus status
    ) {
        return gymService.listByStatus(email, status);
    }

    @PostMapping("/{id}/approve")
    public GymSummaryResponse approve(@AuthenticationPrincipal String email, @PathVariable Long id) {
        return gymService.setStatus(email, id, GymStatus.ACTIVE);
    }

    @PostMapping("/{id}/archive")
    public GymSummaryResponse archive(@AuthenticationPrincipal String email, @PathVariable Long id) {
        return gymService.setStatus(email, id, GymStatus.ARCHIVED);
    }
}
