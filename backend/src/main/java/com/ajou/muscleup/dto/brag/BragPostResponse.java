package com.ajou.muscleup.dto.brag;

import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@AllArgsConstructor
public class BragPostResponse {
    private Long id;
    private String title;
    private String content;
    private String movement;
    private String weight;
    private List<String> mediaUrls;
    private Long likeCount;
    private String authorNickname;
    private Long authorId;      // 신고 · 차단에 쓴다(이메일은 내보내지 않음)
    private boolean mine;
    private LocalDateTime createdAt;
    private BragVisibility visibility;
    private String gymSlug;     // 올린 짐(모임). 광장 글이면 null
    private String gymName;

    public static BragPostResponse from(BragPost post) {
        return from(post, null);
    }

    public static BragPostResponse from(BragPost post, Long likeCount) {
        return from(post, likeCount, null);
    }

    /** viewerId: 지금 보는 사람(내 글 표시용) */
    public static BragPostResponse from(BragPost post, Long likeCount, Long viewerId) {
        Long authorId = post.getUser() != null ? post.getUser().getId() : null;
        return new BragPostResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getMovement(),
                post.getWeight(),
                post.getMediaUrls(),
                likeCount,
                post.getUser() != null ? post.getUser().getNickname() : null,
                authorId,
                viewerId != null && viewerId.equals(authorId),
                post.getCreatedAt(),
                post.getVisibility(),
                post.getGym() != null ? post.getGym().getSlug() : null,
                post.getGym() != null ? post.getGym().getName() : null
        );
    }
}
