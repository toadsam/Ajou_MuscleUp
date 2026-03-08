package com.ajou.muscleup.dto.friend;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendChatRoomResponse {
    private Long roomId;
    private Long friendId;
    private String friendNickname;
}
