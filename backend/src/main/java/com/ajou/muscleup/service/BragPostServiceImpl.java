package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragPostCreateRequest;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class BragPostServiceImpl implements BragPostService {
    private final BragPostRepository bragPostRepository;
    private final UserRepository userRepository;
    private final BragLikeRepository bragLikeRepository;

    @Override
    public BragPostResponse create(String userEmail, BragPostCreateRequest req) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        List<String> media = req.getMediaUrls() == null
                ? List.of()
                : req.getMediaUrls().stream()
                    .filter(url -> url != null && !url.isBlank())
                    .map(String::trim)
                    .collect(Collectors.toCollection(ArrayList::new));

        BragPost saved = bragPostRepository.save(BragPost.builder()
                .user(user)
                .title(req.getTitle().trim())
                .content(req.getContent().trim())
                .movement(req.getMovement() == null ? null : req.getMovement().trim())
                .weight(req.getWeight() == null ? null : req.getWeight().trim())
                .mediaUrls(media)
                .build());

        return BragPostResponse.from(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BragPostResponse> list(Pageable pageable) {
        return bragPostRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(p -> BragPostResponse.from(p, bragLikeRepository.countByPostId(p.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public BragPostResponse get(Long id) {
        BragPost post = bragPostRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        long likes = bragLikeRepository.countByPostId(id);
        return BragPostResponse.from(post, likes);
    }
}
