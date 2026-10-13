package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.GymDecorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 홈 헬스장 꾸미기(본인만).
 *   GET /api/gym-decor               자리마다 놓인 물품 + 물품 목록(얻었는지 · 진행도 · 조건)
 *   PUT /api/gym-decor/slots/{slot}  {code|null} 그 자리에 놓기 · 비우기
 */
@RestController
@RequestMapping("/api/gym-decor")
@RequiredArgsConstructor
public class GymDecorController {
    private final GymDecorService gymDecorService;
    private final UserRepository userRepository;

    public record PlaceRequest(String code) {}

    @GetMapping
    public GymDecorService.View view(@AuthenticationPrincipal String email) {
        return gymDecorService.view(me(email));
    }

    @PutMapping("/slots/{slot}")
    public GymDecorService.View place(@AuthenticationPrincipal String email, @PathVariable String slot,
                                      @RequestBody(required = false) PlaceRequest req) {
        return gymDecorService.place(me(email), slot, req == null ? null : req.code());
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
