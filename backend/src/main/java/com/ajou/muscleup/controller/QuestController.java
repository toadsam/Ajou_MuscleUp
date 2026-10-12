package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.DailyQuestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 오늘 할 일(본인만).
 *   GET /api/quests/today   출석 · 식단 1끼 · 응원 1번 진행, 단백질 목표, 활동 레벨
 */
@RestController
@RequestMapping("/api/quests")
@RequiredArgsConstructor
public class QuestController {
    private final DailyQuestService questService;
    private final UserRepository userRepository;

    @GetMapping("/today")
    public DailyQuestService.Today today(@AuthenticationPrincipal String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        User me = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
        return questService.today(me);
    }
}
