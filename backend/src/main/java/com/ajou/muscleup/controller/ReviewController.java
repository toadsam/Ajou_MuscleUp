package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.review.*;
import com.ajou.muscleup.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {
    private static final int MAX_PAGE_SIZE = 50;
    private final ReviewService reviewService;

    @PostMapping
    public ResponseEntity<ReviewResponse> create(@AuthenticationPrincipal String email,
                                                 @Valid @RequestBody ReviewCreateRequest req) {
        requireEmail(email);
        return ResponseEntity.ok(reviewService.create(email, req));
    }

    @GetMapping
    public ResponseEntity<Page<ReviewResponse>> list(@AuthenticationPrincipal String email,
                                                     @RequestParam(value = "proteinId", required = false) Long proteinId,
                                                     @RequestParam(value = "page", defaultValue = "0") int page,
                                                     @RequestParam(value = "size", defaultValue = "10") int size) {
        // 한 번에 너무 많이 달라는 요청을 막는다(최대 50개), 최신 후기부터
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "id"));
        Page<ReviewResponse> result = reviewService.listByProtein(proteinId, pageable, email);
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ReviewResponse> update(@AuthenticationPrincipal String email,
                                                 @PathVariable("id") Long id,
                                                 @Valid @RequestBody ReviewUpdateRequest req) {
        requireEmail(email);
        return ResponseEntity.ok(reviewService.update(id, email, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email,
                                       @PathVariable("id") Long id) {
        requireEmail(email);
        reviewService.delete(id, email);
        return ResponseEntity.noContent().build();
    }

    private void requireEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다.");
        }
    }
}
