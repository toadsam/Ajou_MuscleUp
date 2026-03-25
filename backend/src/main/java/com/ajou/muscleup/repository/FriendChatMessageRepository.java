package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.FriendChatMessage;
import com.ajou.muscleup.entity.FriendChatRoom;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FriendChatMessageRepository extends JpaRepository<FriendChatMessage, Long> {
    List<FriendChatMessage> findByRoomOrderByIdDesc(FriendChatRoom room, Pageable pageable);
}
