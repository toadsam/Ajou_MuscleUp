package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.eventcms.EventDetailResponse;
import com.ajou.muscleup.dto.eventcms.EventListItemResponse;
import com.ajou.muscleup.dto.eventcms.EventViewClickResponse;
import com.ajou.muscleup.entity.CmsEventStatus;
import com.ajou.muscleup.service.CmsEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventPublicController {
    private final CmsEventService cmsEventService;

    @GetMapping
    public ResponseEntity<Page<EventListItemResponse>> list(
            @RequestParam(required = false) CmsEventStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        int safeSize = Math.max(1, Math.min(50, size));
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);
        return ResponseEntity.ok(cmsEventService.getPublicList(status, q, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventDetailResponse> detail(@PathVariable Long id) {
        return ResponseEntity.ok(cmsEventService.getPublicDetail(id));
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<EventViewClickResponse> increaseView(@PathVariable Long id) {
        return ResponseEntity.ok(cmsEventService.increaseView(id));
    }

    @PostMapping("/{id}/click")
    public ResponseEntity<EventViewClickResponse> increaseClick(@PathVariable Long id) {
        return ResponseEntity.ok(cmsEventService.increaseClick(id));
    }
}
