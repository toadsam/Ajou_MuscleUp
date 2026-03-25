package com.ajou.muscleup.dto.friend;

import com.ajou.muscleup.entity.FriendChatMessage;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendChatMessageResponse {
    private Long id;
    private Long senderId;
    private String senderNickname;
    private String content;
    private LocalDateTime createdAt;

    public static FriendChatMessageResponse from(FriendChatMessage msg) {
        return FriendChatMessageResponse.builder()
                .id(msg.getId())
                .senderId(msg.getSender().getId())
                .senderNickname(msg.getSender().getNickname())
                .content(msg.getContent())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
