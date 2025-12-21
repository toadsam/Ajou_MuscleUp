package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.program.ApplicationRequest;
import com.ajou.muscleup.dto.program.ApplicationResponse;
import com.ajou.muscleup.entity.ApplicationStatus;
import com.ajou.muscleup.entity.ProgramApplication;
import com.ajou.muscleup.repository.ProgramApplicationRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/programs")
@RequiredArgsConstructor
public class ProgramApplicationController {

    private final ProgramApplicationRepository repository;

    @PostMapping("/apply")
    public ResponseEntity<ApplicationResponse> apply(@Valid @RequestBody ApplicationRequest req) {
        ProgramApplication saved = repository.save(ProgramApplication.builder()
                .name(req.getName().trim())
                .email(req.getEmail().trim())
                .goal(req.getGoal().trim())
                .track(req.getTrack().trim())
                .commitment(req.getCommitment().trim())
                .status(ApplicationStatus.PENDING)
                .build());
        return ResponseEntity.ok(ApplicationResponse.from(saved));
    }
}
