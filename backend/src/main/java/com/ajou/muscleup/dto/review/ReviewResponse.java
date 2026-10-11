package com.ajou.muscleup.dto.review;

import com.ajou.muscleup.entity.Review;
import java.time.LocalDateTime;
import lombok.Builder; import lombok.Getter;

@Getter @Builder
public class ReviewResponse {
    private Long id; private Long userId; private String nickname; private Long proteinId;
    private int rating; private String content; private LocalDateTime createdAt;
    private String proteinName; // 어떤 공동구매 후기인지 목록에 보여 준다
    private boolean mine;       // 보는 사람이 쓴 후기인지(수정 · 삭제 버튼용, 이메일은 내보내지 않는다)

    public static ReviewResponse from(Review r){
        return from(r, null);
    }

    /** viewerEmail: 지금 보는 사람(없으면 null) */
    public static ReviewResponse from(Review r, String viewerEmail){
        return ReviewResponse.builder()
                .id(r.getId())
                .userId(r.getUser().getId())
                .nickname(r.getUser().getNickname())
                .proteinId(r.getProtein().getId())
                .proteinName(r.getProtein().getName())
                .mine(viewerEmail != null && viewerEmail.equalsIgnoreCase(r.getUser().getEmail()))
                .rating(r.getRating())
                .content(r.getContent())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
