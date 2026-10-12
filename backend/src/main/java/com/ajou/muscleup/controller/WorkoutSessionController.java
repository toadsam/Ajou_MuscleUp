package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.WorkoutSessionService;
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
 * 운동 세션(본인만).
 *   GET    /api/workouts?month=YYYY-MM          그달 세션 목록(최근 순)
 *   GET    /api/workouts/{id}                   세션 자세히(종목 · 세트)
 *   GET    /api/workouts/previous?exercise=     이 종목을 한 가장 최근 세션의 세트(없으면 빈 응답)
 *   POST   /api/workouts                        끝낸 세션 저장 → 개인 최고 · 3대 · 출석
 *   DELETE /api/workouts/{id}                   지우기(그 세션이 만든 운동 기록도)
 */
@RestController
@RequestMapping("/api/workouts")
@RequiredArgsConstructor
public class WorkoutSessionController {
    private final WorkoutSessionService sessionService;
    private final UserRepository userRepository;

    @GetMapping
    public List<WorkoutSessionService.Summary> list(@AuthenticationPrincipal String email, @RequestParam(required = false) String month) {
        YearMonth m = null;
        if (month != null && !month.isBlank()) {
            try {
                m = YearMonth.parse(month);
            } catch (DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month 는 2026-10 처럼 보내 주세요.");
            }
        }
        return sessionService.list(me(email), m);
    }

    @GetMapping("/previous")
    public ResponseEntity<WorkoutSessionService.Previous> previous(@AuthenticationPrincipal String email, @RequestParam String exercise) {
        WorkoutSessionService.Previous p = sessionService.previous(me(email), exercise);
        return p == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(p);
    }

    @GetMapping("/{id}")
    public WorkoutSessionService.Detail get(@AuthenticationPrincipal String email, @PathVariable Long id) {
        return sessionService.get(me(email), id);
    }

    @PostMapping
    public ResponseEntity<WorkoutSessionService.SaveResult> save(@AuthenticationPrincipal String email,
                                                                 @RequestBody WorkoutSessionService.SaveRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sessionService.save(me(email), email, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email, @PathVariable Long id) {
        sessionService.delete(me(email), id);
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
