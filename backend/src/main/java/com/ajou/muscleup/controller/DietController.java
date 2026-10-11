package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.DietService;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 식단 기록(본인만).
 *   GET    /api/diet/day?date=           하루 기록 · 합계 · 목표
 *   GET    /api/diet/summary?from=&to=   날짜별 합계(최대 31일, 기본 최근 7일)
 *   GET    /api/diet/recent-foods        최근 적은 음식(다시 넣기)
 *   POST   /api/diet/entries             기록 추가 { date, mealType, name, amount, kcal, proteinG, carbG, fatG }
 *   PUT    /api/diet/entries/{id}        고치기
 *   DELETE /api/diet/entries/{id}        지우기
 *   GET    /api/diet/goal                목표(없으면 체중으로 만든 제안, 둘 다 없으면 빈 응답)
 *   PUT    /api/diet/goal                목표 저장 { kcal, proteinG, carbG, fatG, source: MANUAL|INBODY }
 *   DELETE /api/diet/goal                목표 지우기
 */
@RestController
@RequestMapping("/api/diet")
@RequiredArgsConstructor
public class DietController {
    private final DietService dietService;
    private final UserRepository userRepository;

    @GetMapping("/day")
    public DietService.DayView day(@AuthenticationPrincipal String email,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dietService.day(me(email), date);
    }

    @GetMapping("/summary")
    public List<DietService.DaySummary> summary(@AuthenticationPrincipal String email,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return dietService.summary(me(email), from, to);
    }

    @GetMapping("/recent-foods")
    public List<DietService.RecentFood> recentFoods(@AuthenticationPrincipal String email) {
        return dietService.recentFoods(me(email));
    }

    @PostMapping("/entries")
    public ResponseEntity<DietService.EntryView> add(@AuthenticationPrincipal String email, @RequestBody DietService.EntryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dietService.add(me(email), req));
    }

    @PutMapping("/entries/{id}")
    public DietService.EntryView update(@AuthenticationPrincipal String email, @PathVariable Long id,
                                        @RequestBody DietService.EntryRequest req) {
        return dietService.update(me(email), id, req);
    }

    @DeleteMapping("/entries/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email, @PathVariable Long id) {
        dietService.delete(me(email), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/goal")
    public ResponseEntity<DietService.GoalView> goal(@AuthenticationPrincipal String email) {
        DietService.GoalView goal = dietService.goal(me(email));
        return goal == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(goal);
    }

    @PutMapping("/goal")
    public DietService.GoalView saveGoal(@AuthenticationPrincipal String email, @RequestBody DietService.GoalRequest req) {
        return dietService.saveGoal(me(email), req);
    }

    @DeleteMapping("/goal")
    public ResponseEntity<Void> deleteGoal(@AuthenticationPrincipal String email) {
        dietService.deleteGoal(me(email));
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
