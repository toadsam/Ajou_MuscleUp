package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.brag.BragPostCreateRequest;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import com.ajou.muscleup.dto.brag.BragPostUpdateRequest;
import com.ajou.muscleup.service.BragPostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@RestController
@RequestMapping("/api/brags")
@RequiredArgsConstructor
public class BragPostController {
    private final BragPostService bragPostService;

    @PostMapping
    public ResponseEntity<BragPostResponse> create(@AuthenticationPrincipal String email,
                                                   @Valid @RequestBody BragPostCreateRequest req) {
        requireEmail(email);
        return ResponseEntity.ok(bragPostService.create(email, req));
    }

    @GetMapping
    public ResponseEntity<Page<BragPostResponse>> list(@AuthenticationPrincipal String email,
                                                       @RequestParam(value = "page", defaultValue = "0") int page,
                                                       @RequestParam(value = "size", defaultValue = "10") int size) {
        requireEmail(email);
        Pageable pageable = PageRequest.of(page, Math.min(size, 30));
        return ResponseEntity.ok(bragPostService.list(email, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BragPostResponse> get(@AuthenticationPrincipal String email,
                                                @PathVariable("id") Long id) {
        requireEmail(email);
        return ResponseEntity.ok(bragPostService.get(id, email));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BragPostResponse> update(@AuthenticationPrincipal String email,
                                                   @PathVariable("id") Long id,
                                                   @Valid @RequestBody BragPostUpdateRequest req) {
        requireEmail(email);
        return ResponseEntity.ok(bragPostService.update(id, email, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email,
                                       @PathVariable("id") Long id) {
        requireEmail(email);
        bragPostService.delete(id, email);
        return ResponseEntity.noContent().build();
    }

    private void requireEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다.");
        }
    }
}
