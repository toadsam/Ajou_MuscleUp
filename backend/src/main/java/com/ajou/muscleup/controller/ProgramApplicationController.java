package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.program.ApplicationRequest;
import com.ajou.muscleup.dto.program.ApplicationResponse;
import com.ajou.muscleup.entity.ApplicationStatus;
import com.ajou.muscleup.entity.ProgramApplication;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.repository.ProgramApplicationRepository;
import com.ajou.muscleup.service.GymScope;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class ProgramApplicationController {

    private final ProgramApplicationRepository repository;
    private final GymScope gymScope;

    @PostMapping("/apply")
    public ResponseEntity<ApplicationResponse> apply(@Valid @RequestBody ApplicationRequest req,
                                                     @AuthenticationPrincipal String email) {
        ProgramApplication saved = repository.save(ProgramApplication.builder()
                .name(req.getName().trim())
                .email(req.getEmail().trim())
                .goal(req.getGoal().trim())
                .track(req.getTrack().trim())
                .commitment(req.getCommitment().trim())
                .status(ApplicationStatus.PENDING)
                .gym(gymOrNull(req.getGymSlug(), email))
                .build());
        return ResponseEntity.ok(ApplicationResponse.from(saved));
    }

    /** 신청은 모임 때문에 실패하지 않게: 없는 모임이거나 내가 볼 수 없는 모임이면 앱 전체 신청으로 받는다 */
    private WorkoutCrew gymOrNull(String slug, String email) {
        if (slug == null || slug.isBlank()) return null;
        try {
            WorkoutCrew gym = gymScope.gymOrThrow(slug);
            return gymScope.canSee(gym, gymScope.findUser(email)) ? gym : null;
        } catch (ResponseStatusException e) {
            return null;
        }
    }
}
