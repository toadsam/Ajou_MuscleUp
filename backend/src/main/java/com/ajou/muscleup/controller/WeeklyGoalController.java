package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.WeeklyGoalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 주간 목표 연속 기록(본인만).
 *   GET /api/attendance/weekly-goal        이번 주 진행 · 연속 달성 주 · 보너스
 *   PUT /api/attendance/weekly-goal        목표 바꾸기 { target: 1~7 } — 이번 주에 운동했으면 다음 주부터
 *   PUT /api/attendance/weekly-goal/rest   쉬는 주 { rest: true|false } — 4주에 한 번
 */
@RestController
@RequestMapping("/api/attendance/weekly-goal")
@RequiredArgsConstructor
public class WeeklyGoalController {
    private final WeeklyGoalService weeklyGoalService;
    private final UserRepository userRepository;

    public record TargetRequest(Integer target) {}

    public record RestRequest(Boolean rest) {}

    @GetMapping
    public WeeklyGoalService.Status status(@AuthenticationPrincipal String email) {
        return weeklyGoalService.status(me(email));
    }

    @PutMapping
    public WeeklyGoalService.Status setTarget(@AuthenticationPrincipal String email, @RequestBody TargetRequest req) {
        if (req == null || req.target() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주간 목표를 골라 주세요.");
        }
        return weeklyGoalService.setTarget(me(email), req.target());
    }

    @PutMapping("/rest")
    public WeeklyGoalService.Status setRest(@AuthenticationPrincipal String email, @RequestBody RestRequest req) {
        return weeklyGoalService.setRest(me(email), req != null && Boolean.TRUE.equals(req.rest()));
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
