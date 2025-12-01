package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.brag.MyPageResponse;
import com.ajou.muscleup.service.MyPageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
public class MyPageController {
    private final MyPageService myPageService;

    @GetMapping
    public ResponseEntity<MyPageResponse> get(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(myPageService.fetch(email));
    }
}
