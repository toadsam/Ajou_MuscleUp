package com.ajou.muscleup.dto.eventcms;

import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class EventListItemResponse {
    private Long id;
    private String title;
    private String summary;
    private String thumbnailUrl;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private CmsEventStatus status;
    private boolean isMainBanner;
    private boolean isPinned;
    private int priority;
    private long viewCount;
    private String gymSlug;     // 짐 소식이면 그 짐, 앱 전체 공지면 null
    private String gymName;

    public static EventListItemResponse from(CmsEvent event) {
        return EventListItemResponse.builder()
                .id(event.getId())
                .title(event.getTitle())
                .summary(event.getSummary())
                .thumbnailUrl(event.getThumbnailUrl())
                .startAt(event.getStartAt())
                .endAt(event.getEndAt())
                .status(event.getStatus())
                .isMainBanner(event.isMainBanner())
                .isPinned(event.isPinned())
                .priority(event.getPriority())
                .viewCount(event.getViewCount())
                .gymSlug(event.getGym() != null ? event.getGym().getSlug() : null)
                .gymName(event.getGym() != null ? event.getGym().getName() : null)
                .build();
    }
}
