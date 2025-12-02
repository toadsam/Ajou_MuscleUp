package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AiChatMessage;
import com.ajou.muscleup.entity.AiMessageType;
import com.ajou.muscleup.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AiChatMessageRepository extends JpaRepository<AiChatMessage, Long> {
    Page<AiChatMessage> findByUser(User user, Pageable pageable);

    Page<AiChatMessage> findByUserAndType(User user, AiMessageType type, Pageable pageable);

    Optional<AiChatMessage> findByIdAndUser(Long id, User user);

    Optional<AiChatMessage> findByShareSlug(String shareSlug);
}
