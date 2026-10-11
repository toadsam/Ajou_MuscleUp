package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.club.ClubRosterResponse;
import com.ajou.muscleup.dto.club.ClubRosterUpdateRequest;
import com.ajou.muscleup.service.ClubRosterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 동아리 회원 명단. 읽기는 로그인한 회원(SecurityConfig 의 /api/** 규칙),
 * 바꾸기는 관리자만(/api/admin/** 규칙).
 */
@RestController
@RequiredArgsConstructor
public class ClubRosterController {
    private final ClubRosterService clubRosterService;

    @GetMapping("/api/club/roster")
    public ResponseEntity<ClubRosterResponse> get() {
        return ResponseEntity.ok(clubRosterService.get());
    }

    @PutMapping("/api/admin/club/roster")
    public ResponseEntity<ClubRosterResponse> replace(@Valid @RequestBody ClubRosterUpdateRequest request) {
        return ResponseEntity.ok(clubRosterService.replace(request.names()));
    }
}
