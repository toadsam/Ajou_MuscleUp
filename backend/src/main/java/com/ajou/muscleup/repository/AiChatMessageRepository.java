package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AiChatMessage;
import com.ajou.muscleup.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiChatMessageRepository extends JpaRepository<AiChatMessage, Long> {
    List<AiChatMessage> findTop50ByUserOrderByCreatedAtDesc(User user);
}
