package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.ActivityService;
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
 * 내가 추가한 운동(필라테스 · 수영 등, 본인만). 시간 + 메모만 기록한다.
 *   GET    /api/activities                 내 운동 종류
 *   POST   /api/activities                 종류 추가 { name, category: WEIGHT | CARDIO | STRETCH }
 *   DELETE /api/activities/{id}            종류 지우기(지난 기록은 남음)
 *   POST   /api/activities/{id}/logs       기록 { durationSec, endedAt?, note?, checkAttendance? } → 출석
 *   GET    /api/activities/logs?month=     그달 기록(최근 순)
 *   DELETE /api/activities/logs/{id}       기록 지우기
 */
@RestController
@RequestMapping("/api/activities")
@RequiredArgsConstructor
public class ActivityController {
    private final ActivityService activityService;
    private final UserRepository userRepository;

    @GetMapping
    public List<ActivityService.ActivityView> list(@AuthenticationPrincipal String email) {
        return activityService.list(me(email));
    }

    @PostMapping
    public ResponseEntity<ActivityService.ActivityView> add(@AuthenticationPrincipal String email, @RequestBody ActivityService.AddRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(activityService.add(me(email), req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal String email, @PathVariable Long id) {
        activityService.remove(me(email), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/logs")
    public ResponseEntity<ActivityService.LogResult> log(@AuthenticationPrincipal String email, @PathVariable Long id,
                                                         @RequestBody ActivityService.LogRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(activityService.log(me(email), email, id, req));
    }

    @GetMapping("/logs")
    public List<ActivityService.LogView> logs(@AuthenticationPrincipal String email, @RequestParam(required = false) String month) {
        YearMonth m = null;
        if (month != null && !month.isBlank()) {
            try {
                m = YearMonth.parse(month);
            } catch (DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month 는 2026-10 처럼 보내 주세요.");
            }
        }
        return activityService.logs(me(email), m);
    }

    @DeleteMapping("/logs/{id}")
    public ResponseEntity<Void> deleteLog(@AuthenticationPrincipal String email, @PathVariable Long id) {
        activityService.deleteLog(me(email), id);
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
