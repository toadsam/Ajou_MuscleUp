package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.RunService;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 러닝 기록(본인만). 경로(위치)는 받지 않는다 — 휴대폰에만.
 *   GET    /api/runs?month=YYYY-MM   그달 러닝 목록(최근 순)
 *   GET    /api/runs/records         내 기록(가장 긴 거리 · 가장 빠른 1km · 5km · 10km) + 이번 주 · 이번 달 거리
 *   GET    /api/runs/{id}            러닝 한 번(구간 포함)
 *   POST   /api/runs                 끝낸 러닝 저장 → 기록 · 점수 · 출석
 *   DELETE /api/runs/{id}            지우기
 */
@RestController
@RequestMapping("/api/runs")
@RequiredArgsConstructor
public class RunController {
    private final RunService runService;
    private final UserRepository userRepository;

    @GetMapping
    public List<RunService.RunView> list(@AuthenticationPrincipal String email, @RequestParam(required = false) String month) {
        YearMonth m = null;
        if (month != null && !month.isBlank()) {
            try {
                m = YearMonth.parse(month);
            } catch (DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month 는 2026-10 처럼 보내 주세요.");
            }
        }
        return runService.list(me(email), m);
    }

    @GetMapping("/records")
    public RunService.Records records(@AuthenticationPrincipal String email) {
        return runService.records(me(email));
    }

    @GetMapping("/{id}")
    public RunService.RunView get(@AuthenticationPrincipal String email, @PathVariable Long id) {
        return runService.get(me(email), id);
    }

    @PostMapping
    public ResponseEntity<RunService.SaveResult> save(@AuthenticationPrincipal String email, @RequestBody RunService.SaveRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(runService.save(me(email), email, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email, @PathVariable Long id) {
        runService.delete(me(email), id);
        return ResponseEntity.noContent().build();
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
