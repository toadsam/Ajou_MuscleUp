package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.dto.event.EventResponse;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.EventService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final EventService eventService;
    private final UserRepository userRepository;

    @GetMapping("/active")
    public ResponseEntity<List<EventResponse>> getActiveEvents() {
        List<EventResponse> events = eventService.getActiveEvents(LocalDate.now(KST));
        return ResponseEntity.ok(events);
    }

    @GetMapping("/me/active")
    public ResponseEntity<List<EventProgressResponse>> getMyActiveEvents(
            @AuthenticationPrincipal String email
    ) {
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.UNAUTHORIZED,
                        "Unauthorized"
                ));
        List<EventProgressResponse> progress =
                eventService.getActiveProgress(user, LocalDate.now(KST));
        return ResponseEntity.ok(progress);
    }
}
