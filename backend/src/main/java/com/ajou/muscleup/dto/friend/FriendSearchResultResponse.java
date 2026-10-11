package com.ajou.muscleup.dto.friend;

import lombok.Builder;
import lombok.Getter;

/** 닉네임 검색 결과. 이메일은 넣지 않는다. relation: FRIEND | OUTGOING | INCOMING | NONE */
@Getter
@Builder
public class FriendSearchResultResponse {
    private Long userId;
    private String nickname;
    private FriendCharacterResponse character;
    private String relation;
}
