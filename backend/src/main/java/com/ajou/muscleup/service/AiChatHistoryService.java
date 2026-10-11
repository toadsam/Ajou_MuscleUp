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
    private static final int MAX_RECENT_LIMIT = 50;

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

        // limit 이 0 이하면 PageRequest 가 IllegalArgumentException(500)을 내고, 너무 크면 한 번에 다 읽는다.
        int safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_LIMIT));
        Pageable pageable = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt"));
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록에 없는 메시지입니다."));

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록에 없는 메시지입니다."));

        message.setShared(false);
        message.setShareSlug(null);
        messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public AiShareResponse getSharedBySlug(String slug) {
        AiChatMessage message = messageRepository.findByShareSlug(slug)
                .filter(AiChatMessage::isShared)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공유된 대화가 아니거나 공유가 해제되었습니다."));
        return toShareResponse(message);
    }

    private User loadUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "사용자 정보를 찾을 수 없습니다."));
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
