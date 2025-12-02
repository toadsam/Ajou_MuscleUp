package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.ai.AiChatLogItem;
import com.ajou.muscleup.dto.ai.AiShareResponse;
import com.ajou.muscleup.entity.AiChatMessage;
import com.ajou.muscleup.entity.AiMessageType;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AiChatMessageRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiChatHistoryService {

    private final AiChatMessageRepository messageRepository;
    private final UserRepository userRepository;

    @Transactional
    public AiChatMessage save(String email, AiMessageType type, String question, String answer) {
        User user = loadUser(email);

        AiChatMessage message = AiChatMessage.builder()
                .user(user)
                .type(type)
                .question(question)
                .answer(answer)
                .build();
        return messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public List<AiChatLogItem> getRecent(String email, AiMessageType type, int limit) {
        User user = loadUser(email);

        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        return (type == null
                ? messageRepository.findByUser(user, pageable)
                : messageRepository.findByUserAndType(user, type, pageable))
                .stream()
                .map(this::toLogItem)
                .toList();
    }

    @Transactional
    public AiShareResponse share(String email, Long messageId) {
        User user = loadUser(email);
        AiChatMessage message = messageRepository.findByIdAndUser(messageId, user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "�?록�?는 메시지�??�습?�다."));

        if (message.getShareSlug() == null || message.getShareSlug().isBlank()) {
            message.setShareSlug(UUID.randomUUID().toString().replace("-", ""));
        }
        message.setShared(true);
        AiChatMessage saved = messageRepository.save(message);
        return toShareResponse(saved);
    }

    @Transactional
    public void unshare(String email, Long messageId) {
        User user = loadUser(email);
        AiChatMessage message = messageRepository.findByIdAndUser(messageId, user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "�?록�?는 메시지�??�습?�다."));

        message.setShared(false);
        message.setShareSlug(null);
        messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public AiShareResponse getSharedBySlug(String slug) {
        AiChatMessage message = messageRepository.findByShareSlug(slug)
                .filter(AiChatMessage::isShared)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공유�??�용?� 메시지�? 아�???�니??"));
        return toShareResponse(message);
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "?�용?��? 존재?��? ?�습?�다."));
    }

    private AiChatLogItem toLogItem(AiChatMessage m) {
        return new AiChatLogItem(
                m.getId(),
                m.getType(),
                m.getQuestion(),
                m.getAnswer(),
                m.getCreatedAt(),
                m.isShared(),
                m.getShareSlug()
        );
    }

    private AiShareResponse toShareResponse(AiChatMessage message) {
        return new AiShareResponse(
                message.getId(),
                message.getType(),
                message.getQuestion(),
                message.getAnswer(),
                message.getCreatedAt(),
                message.getShareSlug()
        );
    }
}
