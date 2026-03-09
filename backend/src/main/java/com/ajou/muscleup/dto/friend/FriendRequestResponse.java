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
    private FriendCharacterResponse requesterCharacter;
    private String receiverEmail;
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
                .requesterEmail(req.getRequester().getEmail())
                .requesterNickname(req.getRequester().getNickname())
                .requesterCharacter(requesterCharacter)
                .receiverEmail(req.getReceiver().getEmail())
                .receiverNickname(req.getReceiver().getNickname())
                .receiverCharacter(receiverCharacter)
                .status(req.getStatus())
                .build();
    }
}
