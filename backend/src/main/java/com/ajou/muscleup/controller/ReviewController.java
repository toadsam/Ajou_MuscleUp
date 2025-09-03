package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.review.*;
import com.ajou.muscleup.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page; import org.springframework.data.domain.PageRequest; import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity; import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {
    private final ReviewService reviewService;

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ReviewCreateRequest req) {
        return ResponseEntity.ok(reviewService.create(req));
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam Long proteinId,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ReviewResponse> result = reviewService.listByProtein(proteinId, pageable);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, @RequestParam Long requesterUserId) {
        reviewService.delete(id, requesterUserId);
        return ResponseEntity.ok().build();
    }
}
