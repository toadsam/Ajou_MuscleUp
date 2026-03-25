package com.ajou.muscleup.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "cms_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CmsEvent extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 300)
    private String summary;

    @Lob
    @Column(nullable = false)
    private String content;

    @Column(name = "thumbnail_url", nullable = false, length = 500)
    private String thumbnailUrl;

    @Column(name = "banner_url", length = 500)
    private String bannerUrl;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CmsEventStatus status;

    @Column(name = "is_main_banner", nullable = false)
    private boolean isMainBanner;

    @Column(name = "is_pinned", nullable = false)
    private boolean isPinned;

    @Column(nullable = false)
    private int priority;

    @Column(name = "cta_text", nullable = false, length = 60)
    private String ctaText;

    @Column(name = "cta_link", nullable = false, length = 500)
    private String ctaLink;

    @Column(name = "view_count", nullable = false)
    private long viewCount;

    @Column(name = "click_count", nullable = false)
    private long clickCount;

    @Column(name = "created_by")
    private Long createdBy;

    @ElementCollection
    @CollectionTable(name = "cms_event_tags", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "tag", length = 40, nullable = false)
    @Builder.Default
    private List<String> tags = new ArrayList<>();
}
