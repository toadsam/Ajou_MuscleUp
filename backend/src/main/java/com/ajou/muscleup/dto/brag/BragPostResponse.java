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
    private String authorEmail;
    private LocalDateTime createdAt;
    private BragVisibility visibility;

    public static BragPostResponse from(BragPost post) {
        return from(post, null);
    }

    public static BragPostResponse from(BragPost post, Long likeCount) {
        return new BragPostResponse(
                post.getId(),
                post.getTitle(),
                post.getContent(),
                post.getMovement(),
                post.getWeight(),
                post.getMediaUrls(),
                likeCount,
                post.getUser() != null ? post.getUser().getNickname() : null,
                post.getUser() != null ? post.getUser().getEmail() : null,
                post.getCreatedAt(),
                post.getVisibility()
        );
    }
}
