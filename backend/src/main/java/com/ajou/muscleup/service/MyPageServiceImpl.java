package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.ai.AiChatLogItem;
import com.ajou.muscleup.dto.brag.BragCommentResponse;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import com.ajou.muscleup.dto.brag.MyPageResponse;
import com.ajou.muscleup.entity.BragLike;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.BragCommentRepository;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MyPageServiceImpl implements MyPageService {
    private final UserRepository userRepository;
    private final BragCommentRepository commentRepository;
    private final BragLikeRepository likeRepository;
    private final BragPostService bragPostService;
    private final AiChatHistoryService aiChatHistoryService;

    @Override
    public MyPageResponse fetch(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        List<BragCommentResponse> comments = commentRepository.findTop20ByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream().map(BragCommentResponse::from).toList();

        List<BragPostResponse> likes = likeRepository.findRecentByUser(user.getId()).stream()
                .limit(20)
                .map(BragLike::getBragPost)
                .map(p -> BragPostResponse.from(p, likeRepository.countByPostId(p.getId())))
                .toList();

        List<AiChatLogItem> chats = aiChatHistoryService.getRecent(userEmail, 20);

        return new MyPageResponse(user.getEmail(), user.getNickname(), comments, likes, chats);
    }
}
