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
    private Long authorId;      // 신고 · 차단에 쓴다(이메일은 내보내지 않음)
    private boolean mine;
    private LocalDateTime createdAt;

    public static BragCommentResponse from(BragComment c) {
        return from(c, null);
    }

    /** viewerId: 지금 보는 사람(내 댓글 표시용) */
    public static BragCommentResponse from(BragComment c, Long viewerId) {
        Long authorId = c.getUser() != null ? c.getUser().getId() : null;
        return new BragCommentResponse(
                c.getId(),
                c.getContent(),
                c.getUser() != null ? c.getUser().getNickname() : null,
                authorId,
                viewerId != null && viewerId.equals(authorId),
                c.getCreatedAt()
        );
    }
}
