package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.eventcms.EventAdminListResponse;
import com.ajou.muscleup.dto.eventcms.EventDetailResponse;
import com.ajou.muscleup.dto.eventcms.EventSaveRequest;
import com.ajou.muscleup.dto.eventcms.EventStatusPatchRequest;
import com.ajou.muscleup.dto.eventcms.EventToggleRequest;
import com.ajou.muscleup.entity.CmsEventStatus;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.CmsEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/events")
@RequiredArgsConstructor
public class AdminEventController {
    private final CmsEventService cmsEventService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Page<EventAdminListResponse>> list(
            @RequestParam(required = false) CmsEventStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);
        return ResponseEntity.ok(cmsEventService.getAdminList(status, q, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(cmsEventService.getAdminDetail(id));
    }

    @PostMapping
    public ResponseEntity<EventDetailResponse> create(
            @Valid @RequestBody EventSaveRequest request,
            @AuthenticationPrincipal String email
    ) {
        Long adminId = userRepository.findByEmail(email)
                .map(user -> user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        return ResponseEntity.status(HttpStatus.CREATED).body(cmsEventService.create(request, adminId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventDetailResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody EventSaveRequest request
    ) {
        return ResponseEntity.ok(cmsEventService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        cmsEventService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<EventDetailResponse> patchStatus(
            @PathVariable Long id,
            @Valid @RequestBody EventStatusPatchRequest request
    ) {
        return ResponseEntity.ok(cmsEventService.patchStatus(id, request.getStatus()));
    }

    @PatchMapping("/{id}/main-banner")
    public ResponseEntity<EventDetailResponse> patchMainBanner(
            @PathVariable Long id,
            @Valid @RequestBody EventToggleRequest request
    ) {
        return ResponseEntity.ok(cmsEventService.patchMainBanner(id, request.getValue()));
    }

    @PatchMapping("/{id}/pin")
    public ResponseEntity<EventDetailResponse> patchPin(
            @PathVariable Long id,
            @Valid @RequestBody EventToggleRequest request
    ) {
        return ResponseEntity.ok(cmsEventService.patchPin(id, request.getValue()));
    }
}
