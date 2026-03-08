package com.ajou.muscleup.dto.friend;

import com.ajou.muscleup.entity.FriendRequest;
import com.ajou.muscleup.entity.FriendRequestStatus;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendRequestResponse {
    private Long id;
    private String requesterEmail;
    private String requesterNickname;
    private String receiverEmail;
    private String receiverNickname;
    private FriendRequestStatus status;

    public static FriendRequestResponse from(FriendRequest req) {
        return FriendRequestResponse.builder()
                .id(req.getId())
                .requesterEmail(req.getRequester().getEmail())
                .requesterNickname(req.getRequester().getNickname())
                .receiverEmail(req.getReceiver().getEmail())
                .receiverNickname(req.getReceiver().getNickname())
                .status(req.getStatus())
                .build();
    }
}
