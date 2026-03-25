package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.friend.*;
import com.ajou.muscleup.service.FriendService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/friends")
public class FriendController {
    private final FriendService friendService;

    @PostMapping("/requests")
    public ResponseEntity<FriendRequestResponse> sendRequest(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody FriendRequestCreateRequest request
    ) {
        return ResponseEntity.ok(friendService.sendRequest(email, request));
    }

    @GetMapping("/requests/incoming")
    public ResponseEntity<List<FriendRequestResponse>> incoming(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(friendService.listIncoming(email));
    }

    @GetMapping("/requests/outgoing")
    public ResponseEntity<List<FriendRequestResponse>> outgoing(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(friendService.listOutgoing(email));
    }

    @PostMapping("/requests/{requestId}/accept")
    public ResponseEntity<FriendRequestResponse> accept(
            @AuthenticationPrincipal String email,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(friendService.acceptRequest(email, requestId));
    }

    @PostMapping("/requests/{requestId}/reject")
    public ResponseEntity<Void> reject(@AuthenticationPrincipal String email, @PathVariable Long requestId) {
        friendService.rejectRequest(email, requestId);
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<List<FriendSummaryResponse>> list(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(friendService.listFriends(email));
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email, @PathVariable Long friendId) {
        friendService.deleteFriend(email, friendId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/chat/rooms")
    public ResponseEntity<List<FriendChatRoomResponse>> chatRooms(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(friendService.listChatRooms(email));
    }

    @GetMapping("/chat/rooms/{friendId}/messages")
    public ResponseEntity<List<FriendChatMessageResponse>> messages(
            @AuthenticationPrincipal String email,
            @PathVariable Long friendId,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(friendService.listMessages(email, friendId, size));
    }

    @PostMapping("/chat/rooms/{friendId}/messages")
    public ResponseEntity<FriendChatMessageResponse> sendMessage(
            @AuthenticationPrincipal String email,
            @PathVariable Long friendId,
            @Valid @RequestBody FriendChatMessageCreateRequest request
    ) {
        return ResponseEntity.ok(friendService.sendMessage(email, friendId, request.getContent()));
    }
}
