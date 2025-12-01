package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.ai.AiChatLogItem;
import com.ajou.muscleup.entity.AiChatMessage;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AiChatMessageRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AiChatHistoryService {

    private final AiChatMessageRepository messageRepository;
    private final UserRepository userRepository;

    @Transactional
    public void save(String email, String question, String answer) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자가 존재하지 않습니다."));

        AiChatMessage message = AiChatMessage.builder()
                .user(user)
                .question(question)
                .answer(answer)
                .build();
        messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public List<AiChatLogItem> getRecent(String email, int limit) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자가 존재하지 않습니다."));

        return messageRepository.findTop50ByUserOrderByCreatedAtDesc(user).stream()
                .limit(limit)
                .map(m -> new AiChatLogItem(m.getQuestion(), m.getAnswer(), m.getCreatedAt()))
                .toList();
    }
}
