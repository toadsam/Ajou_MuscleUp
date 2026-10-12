package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.CollectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 도감 · 보상 상자(본인만).
 *   GET  /api/collection              도감 전체(처음이면 환영 상자 하나, 업적 확인)
 *   GET  /api/collection/summary      홈 · 마이페이지용(상자 수 · 장착 · 활동 레벨)
 *   POST /api/collection/boxes/open   상자 하나 열기
 *   POST /api/collection/craft        조각으로 만들기 {code}
 *   PUT  /api/collection/equip        장착 {category: TITLE|TANK|FRAME, code|null}
 */
@RestController
@RequestMapping("/api/collection")
@RequiredArgsConstructor
public class CollectionController {
    private final CollectionService collectionService;
    private final UserRepository userRepository;

    public record CraftRequest(String code) {}

    public record EquipRequest(String category, String code) {}

    @GetMapping
    public CollectionService.View view(@AuthenticationPrincipal String email) {
        return collectionService.view(me(email));
    }

    @GetMapping("/summary")
    public CollectionService.Summary summary(@AuthenticationPrincipal String email) {
        return collectionService.summary(me(email));
    }

    @PostMapping("/boxes/open")
    public CollectionService.OpenResult open(@AuthenticationPrincipal String email) {
        return collectionService.open(me(email));
    }

    @PostMapping("/craft")
    public CollectionService.ItemView craft(@AuthenticationPrincipal String email, @RequestBody CraftRequest req) {
        return collectionService.craft(me(email), req == null ? null : req.code());
    }

    @PutMapping("/equip")
    public CollectionService.Equipped equip(@AuthenticationPrincipal String email, @RequestBody EquipRequest req) {
        if (req == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "칸을 골라 주세요.");
        return collectionService.equip(me(email), req.category(), req.code());
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
