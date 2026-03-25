package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.friend.*;
import java.util.List;

public interface FriendService {
    FriendRequestResponse sendRequest(String email, FriendRequestCreateRequest request);

    List<FriendRequestResponse> listIncoming(String email);

    List<FriendRequestResponse> listOutgoing(String email);

    FriendRequestResponse acceptRequest(String email, Long requestId);

    void rejectRequest(String email, Long requestId);

    List<FriendSummaryResponse> listFriends(String email);

    void deleteFriend(String email, Long friendId);

    boolean areFriends(Long userAId, Long userBId);

    List<Long> findFriendIds(Long userId);

    List<FriendChatRoomResponse> listChatRooms(String email);

    List<FriendChatMessageResponse> listMessages(String email, Long friendId, int size);

    FriendChatMessageResponse sendMessage(String email, Long friendId, String content);
}
