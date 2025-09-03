package com.ajou.muscleup.dto.review;

import com.ajou.muscleup.entity.Review;
import java.time.LocalDateTime;
import lombok.Builder; import lombok.Getter;

@Getter @Builder
public class ReviewResponse {
    private Long id; private Long userId; private String nickname; private Long proteinId;
    private int rating; private String content; private LocalDateTime createdAt;

    public static ReviewResponse from(Review r){
        return ReviewResponse.builder()
                .id(r.getId())
                .userId(r.getUser().getId())
                .nickname(r.getUser().getNickname())
                .proteinId(r.getProtein().getId())
                .rating(r.getRating())
                .content(r.getContent())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
