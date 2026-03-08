package com.ajou.muscleup.dto.friend;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendSummaryResponse {
    private Long userId;
    private String email;
    private String nickname;
}
