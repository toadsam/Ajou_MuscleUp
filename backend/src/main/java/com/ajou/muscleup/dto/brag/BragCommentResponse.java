package com.ajou.muscleup.dto.brag;

import com.ajou.muscleup.entity.BragComment;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class BragCommentResponse {
    private Long id;
    private String content;
    private String authorNickname;
    private String authorEmail;
    private LocalDateTime createdAt;

    public static BragCommentResponse from(BragComment c) {
        return new BragCommentResponse(
                c.getId(),
                c.getContent(),
                c.getUser() != null ? c.getUser().getNickname() : null,
                c.getUser() != null ? c.getUser().getEmail() : null,
                c.getCreatedAt()
        );
    }
}
