package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.ExerciseCatalog;
import com.ajou.muscleup.service.LiftExercise;
import com.ajou.muscleup.service.LiftService;
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
 * 운동 기록(본인만).
 *   GET    /api/lifts/exercises          종목 목록
 *   GET    /api/lifts?date=              하루 기록(기본 오늘)
 *   GET    /api/lifts/bests              종목마다 최고 추정 1RM · 최고 무게
 *   GET    /api/lifts/history?exercise=  그래프: 최근 180일 날짜마다 최고 추정 1RM
 *   POST   /api/lifts                    기록 { date?, exercise, weightKg, reps, sets } → 개인 최고 · 3대 갱신 · 점수
 *   DELETE /api/lifts/{id}               지우기(3대 기록은 내려가지 않음)
 *   GET    /api/lifts/recent             최근 한 종목(새것부터 8개, 고르기 화면 "최근")
 *   GET    /api/lifts/custom             내가 직접 추가한 종목
 *   POST   /api/lifts/custom             직접 추가 { name, category, bodyweight }
 *   DELETE /api/lifts/custom/{code}      직접 추가한 종목 지우기(지난 기록 이름은 남음)
 */
@RestController
@RequestMapping("/api/lifts")
@RequiredArgsConstructor
public class LiftController {
    private final LiftService liftService;
    private final ExerciseCatalog catalog;
    private final UserRepository userRepository;

    @GetMapping("/exercises")
    public List<LiftExercise.View> exercises() {
        return LiftExercise.all();
    }

    @GetMapping
    public LiftService.DayView day(@AuthenticationPrincipal String email,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return liftService.day(me(email), date);
    }

    @GetMapping("/bests")
    public List<LiftService.Best> bests(@AuthenticationPrincipal String email) {
        return liftService.bests(me(email));
    }

    @GetMapping("/history")
    public List<LiftService.Point> history(@AuthenticationPrincipal String email, @RequestParam String exercise) {
        return liftService.history(me(email), exercise);
    }

    @PostMapping
    public ResponseEntity<LiftService.SaveResult> add(@AuthenticationPrincipal String email, @RequestBody LiftService.EntryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(liftService.add(me(email), req));
    }

    @GetMapping("/recent")
    public List<ExerciseCatalog.ExerciseDef> recent(@AuthenticationPrincipal String email) {
        return catalog.recent(me(email));
    }

    @GetMapping("/custom")
    public List<ExerciseCatalog.ExerciseDef> customs(@AuthenticationPrincipal String email) {
        return catalog.customs(me(email));
    }

    @PostMapping("/custom")
    public ResponseEntity<ExerciseCatalog.ExerciseDef> addCustom(@AuthenticationPrincipal String email,
                                                                 @RequestBody ExerciseCatalog.CustomRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalog.create(me(email), req));
    }

    @DeleteMapping("/custom/{code}")
    public ResponseEntity<Void> deleteCustom(@AuthenticationPrincipal String email, @PathVariable String code) {
        catalog.delete(me(email), code);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email, @PathVariable Long id) {
        liftService.delete(me(email), id);
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
