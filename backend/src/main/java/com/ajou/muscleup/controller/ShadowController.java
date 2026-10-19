package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.shadow.ShadowHistoryItem;
import com.ajou.muscleup.dto.shadow.ShadowStatusResponse;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.ShadowBossService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 주간 보스 "그림자"(본인만 — 다른 사람의 그림자는 보여 주지 않는다).
 *   GET /api/shadow                  이번 주 그림자(체력 · 들어간 힘 · 공격 목록 · 연속 처치 · 지난주)
 *   GET /api/shadow/history?weeks=8  최근 n 주 전적
 * 공격은 운동 세션 · 러닝 저장(POST /api/workouts · /api/runs)이 하고, 응답의 shadow 칸으로 돌아온다.
 */
@RestController
@RequestMapping("/api/shadow")
@RequiredArgsConstructor
public class ShadowController {
    private final ShadowBossService shadowBossService;
    private final UserRepository userRepository;

    @GetMapping
    public ShadowStatusResponse status(@AuthenticationPrincipal String email) {
        return shadowBossService.status(me(email));
    }

    @GetMapping("/history")
    public List<ShadowHistoryItem> history(@AuthenticationPrincipal String email, @RequestParam(defaultValue = "8") int weeks) {
        return shadowBossService.history(me(email), weeks);
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
