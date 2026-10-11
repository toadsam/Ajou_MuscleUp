package com.ajou.muscleup.dto.friend;

import com.ajou.muscleup.entity.FriendRequest;
import com.ajou.muscleup.entity.FriendRequestStatus;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendRequestResponse {
    private Long id;
    private Long requesterId;
    private String requesterNickname;
    private FriendCharacterResponse requesterCharacter;
    private Long receiverId;
    private String receiverNickname;
    private FriendCharacterResponse receiverCharacter;
    private FriendRequestStatus status;

    public static FriendRequestResponse from(
            FriendRequest req,
            FriendCharacterResponse requesterCharacter,
            FriendCharacterResponse receiverCharacter
    ) {
        return FriendRequestResponse.builder()
                .id(req.getId())
                .requesterId(req.getRequester().getId())
                .requesterNickname(req.getRequester().getNickname())
                .requesterCharacter(requesterCharacter)
                .receiverId(req.getReceiver().getId())
                .receiverNickname(req.getReceiver().getNickname())
                .receiverCharacter(receiverCharacter)
                .status(req.getStatus())
                .build();
    }
}
