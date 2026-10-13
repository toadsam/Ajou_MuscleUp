package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.LiveActivityService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 지금 운동 · 러닝 중(로그인한 사람만).
 *   GET    /api/live   지금 운동 · 러닝 중인 사람 { count, items } — 라운지 운동 구역
 *   PUT    /api/live   운동 · 러닝 중이라고 알리기 { activity: WORKOUT|RUN, exercise } (1분마다, 3분 지나면 빠짐)
 *   DELETE /api/live   끝났다고 알리기
 */
@RestController
@RequestMapping("/api/live")
@RequiredArgsConstructor
public class LiveController {
    private final LiveActivityService liveService;
    private final UserRepository userRepository;

    public record LiveList(int count, List<LiveActivityService.LiveView> items) {}

    @GetMapping
    public LiveList list(@AuthenticationPrincipal String email) {
        List<LiveActivityService.LiveView> items = liveService.list(me(email));
        return new LiveList(Math.max(items.size(), liveService.count()), items);
    }

    @PutMapping
    public ResponseEntity<Void> beat(@AuthenticationPrincipal String email, @RequestBody LiveActivityService.LiveRequest req) {
        liveService.beat(me(email), req);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> end(@AuthenticationPrincipal String email) {
        liveService.end(me(email));
        return ResponseEntity.noContent().build();
    }

    private User me(String email) {
        if (email == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
