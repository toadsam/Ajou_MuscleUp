package com.ajou.muscleup.dto.eventcms;

import com.ajou.muscleup.entity.CmsEventStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EventSaveRequest {
    @NotBlank
    @Size(max = 120)
    private String title;

    @NotBlank
    @Size(max = 300)
    private String summary;

    @NotBlank
    private String content;

    @NotBlank
    @Size(max = 500)
    private String thumbnailUrl;

    @Size(max = 500)
    private String bannerUrl;

    @NotNull
    private LocalDateTime startAt;

    @NotNull
    private LocalDateTime endAt;

    @NotNull
    private CmsEventStatus status;

    private boolean isMainBanner;
    private boolean isPinned;

    @NotNull
    private Integer priority = 0;

    @NotBlank
    @Size(max = 60)
    private String ctaText = "자세히 보기";

    @NotBlank
    @Size(max = 500)
    private String ctaLink;

    private List<@Size(max = 40) String> tags;
}
