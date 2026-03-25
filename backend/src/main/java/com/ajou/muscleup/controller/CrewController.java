package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.crew.CrewCreateRequest;
import com.ajou.muscleup.dto.crew.CrewDetailResponse;
import com.ajou.muscleup.dto.crew.CrewListItemResponse;
import com.ajou.muscleup.dto.crew.CrewUpdateRequest;
import com.ajou.muscleup.dto.crew.CrewChallengeCreateRequest;
import com.ajou.muscleup.dto.crew.CrewChallengeResponse;
import com.ajou.muscleup.service.CrewService;
import jakarta.validation.Valid;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/crew")
public class CrewController {
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");
    private final CrewService crewService;

    @PostMapping("/groups")
    public ResponseEntity<CrewDetailResponse> create(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody CrewCreateRequest request
    ) {
        return ResponseEntity.ok(crewService.create(email, request));
    }

    @GetMapping("/groups")
    public ResponseEntity<List<CrewListItemResponse>> list(
            @AuthenticationPrincipal String email
    ) {
        return ResponseEntity.ok(crewService.list(email));
    }

    @GetMapping("/groups/{crewId}")
    public ResponseEntity<CrewDetailResponse> detail(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId,
            @RequestParam(required = false) String month
    ) {
        YearMonth parsed = parseMonthOrDefault(month);
        return ResponseEntity.ok(crewService.getDetail(email, crewId, parsed));
    }

    @PostMapping("/groups/{crewId}/join")
    public ResponseEntity<Void> join(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId
    ) {
        crewService.join(email, crewId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/groups/{crewId}/leave")
    public ResponseEntity<Void> leave(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId
    ) {
        crewService.leave(email, crewId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/groups/join-by-code/{inviteCode}")
    public ResponseEntity<Void> joinByCode(
            @AuthenticationPrincipal String email,
            @PathVariable String inviteCode
    ) {
        crewService.joinByInviteCode(email, inviteCode);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/groups/{crewId}")
    public ResponseEntity<CrewDetailResponse> update(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId,
            @Valid @RequestBody CrewUpdateRequest request
    ) {
        return ResponseEntity.ok(crewService.update(email, crewId, request));
    }

    @DeleteMapping("/groups/{crewId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId
    ) {
        crewService.delete(email, crewId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/groups/{crewId}/members/{memberUserId}")
    public ResponseEntity<Void> kickMember(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId,
            @PathVariable Long memberUserId
    ) {
        crewService.kickMember(email, crewId, memberUserId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/groups/{crewId}/challenges")
    public ResponseEntity<CrewChallengeResponse> createChallenge(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId,
            @Valid @RequestBody CrewChallengeCreateRequest request
    ) {
        return ResponseEntity.ok(crewService.createChallenge(email, crewId, request));
    }

    @PutMapping("/groups/{crewId}/challenges/{challengeId}")
    public ResponseEntity<CrewChallengeResponse> updateChallenge(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId,
            @PathVariable Long challengeId,
            @Valid @RequestBody CrewChallengeCreateRequest request
    ) {
        return ResponseEntity.ok(crewService.updateChallenge(email, crewId, challengeId, request));
    }

    @DeleteMapping("/groups/{crewId}/challenges/{challengeId}")
    public ResponseEntity<Void> deleteChallenge(
            @AuthenticationPrincipal String email,
            @PathVariable Long crewId,
            @PathVariable Long challengeId
    ) {
        crewService.deleteChallenge(email, crewId, challengeId);
        return ResponseEntity.ok().build();
    }

    private YearMonth parseMonthOrDefault(String month) {
        if (month == null || month.isBlank()) return YearMonth.now();
        try {
            return YearMonth.parse(month, MONTH_FORMAT);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month format. Expected YYYY-MM");
        }
    }
}
