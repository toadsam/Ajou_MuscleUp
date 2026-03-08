package com.ajou.muscleup.dto.eventcms;

import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class EventDetailResponse {
    private Long id;
    private String title;
    private String summary;
    private String content;
    private String thumbnailUrl;
    private String bannerUrl;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private CmsEventStatus status;
    private boolean isMainBanner;
    private boolean isPinned;
    private int priority;
    private String ctaText;
    private String ctaLink;
    private List<String> tags;
    private long viewCount;
    private long clickCount;
    private LocalDateTime updatedAt;

    public static EventDetailResponse from(CmsEvent event) {
        return EventDetailResponse.builder()
                .id(event.getId())
                .title(event.getTitle())
                .summary(event.getSummary())
                .content(event.getContent())
                .thumbnailUrl(event.getThumbnailUrl())
                .bannerUrl(event.getBannerUrl())
                .startAt(event.getStartAt())
                .endAt(event.getEndAt())
                .status(event.getStatus())
                .isMainBanner(event.isMainBanner())
                .isPinned(event.isPinned())
                .priority(event.getPriority())
                .ctaText(event.getCtaText())
                .ctaLink(event.getCtaLink())
                .tags(event.getTags())
                .viewCount(event.getViewCount())
                .clickCount(event.getClickCount())
                .updatedAt(event.getUpdatedAt())
                .build();
    }
}
