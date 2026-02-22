package com.ajou.muscleup.dto.eventcms;

import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class EventAdminListResponse {
    private Long id;
    private String title;
    private CmsEventStatus status;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private boolean isMainBanner;
    private boolean isPinned;
    private int priority;
    private LocalDateTime updatedAt;

    public static EventAdminListResponse from(CmsEvent event) {
        return EventAdminListResponse.builder()
                .id(event.getId())
                .title(event.getTitle())
                .status(event.getStatus())
                .startAt(event.getStartAt())
                .endAt(event.getEndAt())
                .isMainBanner(event.isMainBanner())
                .isPinned(event.isPinned())
                .priority(event.getPriority())
                .updatedAt(event.getUpdatedAt())
                .build();
    }
}
