package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.friend.*;
import com.ajou.muscleup.entity.*;
import com.ajou.muscleup.repository.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class FriendServiceImpl implements FriendService {
    private final UserRepository userRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final FriendshipRepository friendshipRepository;
    private final FriendChatRoomRepository friendChatRoomRepository;
    private final FriendChatMessageRepository friendChatMessageRepository;

    @Override
    public FriendRequestResponse sendRequest(String email, FriendRequestCreateRequest request) {
        User me = requireUser(email);
        User target = userRepository.findByEmail(request.getTargetEmail().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "대상 유저를 찾을 수 없습니다."));
        if (Objects.equals(me.getId(), target.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자기 자신에게 친구 요청을 보낼 수 없습니다.");
        }
        if (areFriends(me.getId(), target.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 친구입니다.");
        }
        if (friendRequestRepository.findByRequesterAndReceiverAndStatus(me, target, FriendRequestStatus.PENDING).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 친구 요청을 보냈습니다.");
        }
        if (friendRequestRepository.findByRequesterAndReceiverAndStatus(target, me, FriendRequestStatus.PENDING).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "상대가 보낸 요청이 있습니다. 수락해주세요.");
        }
        FriendRequest saved = friendRequestRepository.save(FriendRequest.builder()
                .requester(me)
                .receiver(target)
                .status(FriendRequestStatus.PENDING)
                .build());
        return FriendRequestResponse.from(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendRequestResponse> listIncoming(String email) {
        User me = requireUser(email);
        return friendRequestRepository.findAllByReceiverAndStatusOrderByCreatedAtDesc(me, FriendRequestStatus.PENDING)
                .stream().map(FriendRequestResponse::from).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendRequestResponse> listOutgoing(String email) {
        User me = requireUser(email);
        return friendRequestRepository.findAllByRequesterAndStatusOrderByCreatedAtDesc(me, FriendRequestStatus.PENDING)
                .stream().map(FriendRequestResponse::from).toList();
    }

    @Override
    public FriendRequestResponse acceptRequest(String email, Long requestId) {
        User me = requireUser(email);
        FriendRequest req = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구 요청을 찾을 수 없습니다."));
        if (!Objects.equals(req.getReceiver().getId(), me.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 요청만 처리할 수 있습니다.");
        }
        if (req.getStatus() != FriendRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 처리된 요청입니다.");
        }
        req.setStatus(FriendRequestStatus.ACCEPTED);
        saveFriendship(req.getRequester(), req.getReceiver());
        return FriendRequestResponse.from(req);
    }

    @Override
    public void rejectRequest(String email, Long requestId) {
        User me = requireUser(email);
        FriendRequest req = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구 요청을 찾을 수 없습니다."));
        if (!Objects.equals(req.getReceiver().getId(), me.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 요청만 처리할 수 있습니다.");
        }
        req.setStatus(FriendRequestStatus.REJECTED);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendSummaryResponse> listFriends(String email) {
        User me = requireUser(email);
        return friendshipRepository.findAllByUser(me).stream()
                .map(friendship -> Objects.equals(friendship.getUserLow().getId(), me.getId())
                        ? friendship.getUserHigh() : friendship.getUserLow())
                .map(friend -> FriendSummaryResponse.builder()
                        .userId(friend.getId())
                        .email(friend.getEmail())
                        .nickname(friend.getNickname())
                        .build())
                .toList();
    }

    @Override
    public void deleteFriend(String email, Long friendId) {
        User me = requireUser(email);
        User friend = userRepository.findById(friendId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구를 찾을 수 없습니다."));
        User low = pickLow(me, friend);
        User high = pickHigh(me, friend);
        Friendship friendship = friendshipRepository.findByUserLowAndUserHigh(low, high)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구 관계가 없습니다."));
        friendshipRepository.delete(friendship);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean areFriends(Long userAId, Long userBId) {
        if (userAId == null || userBId == null) return false;
        if (Objects.equals(userAId, userBId)) return true;
        User a = userRepository.findById(userAId).orElse(null);
        User b = userRepository.findById(userBId).orElse(null);
        if (a == null || b == null) return false;
        User low = pickLow(a, b);
        User high = pickHigh(a, b);
        return friendshipRepository.findByUserLowAndUserHigh(low, high).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> findFriendIds(Long userId) {
        User me = userRepository.findById(userId).orElse(null);
        if (me == null) return List.of();
        return friendshipRepository.findAllByUser(me).stream()
                .map(friendship -> Objects.equals(friendship.getUserLow().getId(), me.getId())
                        ? friendship.getUserHigh().getId() : friendship.getUserLow().getId())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendChatRoomResponse> listChatRooms(String email) {
        User me = requireUser(email);
        return friendChatRoomRepository.findAllByUser(me).stream()
                .map(room -> {
                    User friend = Objects.equals(room.getUserLow().getId(), me.getId())
                            ? room.getUserHigh() : room.getUserLow();
                    return FriendChatRoomResponse.builder()
                            .roomId(room.getId())
                            .friendId(friend.getId())
                            .friendNickname(friend.getNickname())
                            .build();
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<FriendChatMessageResponse> listMessages(String email, Long friendId, int size) {
        User me = requireUser(email);
        User friend = userRepository.findById(friendId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구를 찾을 수 없습니다."));
        ensureFriends(me, friend);
        FriendChatRoom room = getOrCreateRoom(me, friend);
        int safeSize = Math.max(1, Math.min(size, 100));
        List<FriendChatMessageResponse> result = friendChatMessageRepository
                .findByRoomOrderByIdDesc(room, PageRequest.of(0, safeSize))
                .stream()
                .map(FriendChatMessageResponse::from)
                .toList();
        List<FriendChatMessageResponse> reversed = new ArrayList<>(result);
        Collections.reverse(reversed);
        return reversed;
    }

    @Override
    public FriendChatMessageResponse sendMessage(String email, Long friendId, String content) {
        User me = requireUser(email);
        User friend = userRepository.findById(friendId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구를 찾을 수 없습니다."));
        ensureFriends(me, friend);
        FriendChatRoom room = getOrCreateRoom(me, friend);
        FriendChatMessage saved = friendChatMessageRepository.save(FriendChatMessage.builder()
                .room(room)
                .sender(me)
                .content(content.trim())
                .build());
        return FriendChatMessageResponse.from(saved);
    }

    private void saveFriendship(User userA, User userB) {
        User low = pickLow(userA, userB);
        User high = pickHigh(userA, userB);
        if (friendshipRepository.findByUserLowAndUserHigh(low, high).isPresent()) return;
        friendshipRepository.save(Friendship.builder()
                .userLow(low)
                .userHigh(high)
                .build());
    }

    private FriendChatRoom getOrCreateRoom(User userA, User userB) {
        User low = pickLow(userA, userB);
        User high = pickHigh(userA, userB);
        return friendChatRoomRepository.findByUserLowAndUserHigh(low, high)
                .orElseGet(() -> friendChatRoomRepository.save(FriendChatRoom.builder()
                        .userLow(low)
                        .userHigh(high)
                        .build()));
    }

    private void ensureFriends(User me, User friend) {
        if (!areFriends(me.getId(), friend.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "친구끼리만 채팅할 수 있습니다.");
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private User pickLow(User a, User b) {
        return a.getId() < b.getId() ? a : b;
    }

    private User pickHigh(User a, User b) {
        return a.getId() < b.getId() ? b : a;
    }
}
