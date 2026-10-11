package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragPostCreateRequest;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import com.ajou.muscleup.dto.brag.BragPostUpdateRequest;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.util.RoleUtils;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class BragPostServiceImpl implements BragPostService {
    private final BragPostRepository bragPostRepository;
    private final UserRepository userRepository;
    private final BragLikeRepository bragLikeRepository;
    private final FriendService friendService;

    @PersistenceContext
    private EntityManager entityManager;

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
                .visibility(req.getVisibility() == null ? BragVisibility.PUBLIC : req.getVisibility())
                .build());

        return BragPostResponse.from(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BragPostResponse> list(String userEmail, Pageable pageable) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        List<Long> friendIds = friendService.findFriendIds(user.getId());
        List<Long> allowedUserIds = new ArrayList<>(friendIds);
        allowedUserIds.add(user.getId());
        Page<BragPost> posts = bragPostRepository
                .findByVisibilityOrUser_IdInOrderByCreatedAtDesc(BragVisibility.PUBLIC, allowedUserIds, pageable);
        Map<Long, Long> likeCounts = countLikesByPostIds(posts.getContent().stream().map(BragPost::getId).toList());
        return posts.map(p -> BragPostResponse.from(p, likeCounts.getOrDefault(p.getId(), 0L)));
    }

    @Override
    @Transactional(readOnly = true)
    public BragPostResponse get(Long id, String userEmail) {
        User viewer = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        BragPost post = bragPostRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        if (!canView(post, viewer)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "친구 공개 게시글입니다.");
        }
        long likes = bragLikeRepository.countByPostId(id);
        return BragPostResponse.from(post, likes);
    }

    @Override
    public BragPostResponse update(Long id, String userEmail, BragPostUpdateRequest req) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        BragPost post = bragPostRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));

        if (!post.getUser().getId().equals(user.getId()) && !isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 글만 수정할 수 있습니다.");
        }

        List<String> media = req.getMediaUrls() == null
                ? List.of()
                : req.getMediaUrls().stream()
                .filter(url -> url != null && !url.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(ArrayList::new));

        post.setTitle(req.getTitle().trim());
        post.setContent(req.getContent().trim());
        post.setMovement(req.getMovement() == null ? null : req.getMovement().trim());
        post.setWeight(req.getWeight() == null ? null : req.getWeight().trim());
        post.setMediaUrls(media);
        post.setVisibility(req.getVisibility() == null ? BragVisibility.PUBLIC : req.getVisibility());

        BragPost saved = bragPostRepository.save(post);
        long likes = bragLikeRepository.countByPostId(id);
        return BragPostResponse.from(saved, likes);
    }

    @Override
    public void delete(Long id, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        BragPost post = bragPostRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));

        if (!post.getUser().getId().equals(user.getId()) && !isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 글만 삭제할 수 있습니다.");
        }
        bragPostRepository.delete(post);
    }

    private boolean canView(BragPost post, User viewer) {
        if (post.getVisibility() == BragVisibility.PUBLIC) return true;
        if (post.getUser().getId().equals(viewer.getId())) return true;
        return friendService.areFriends(post.getUser().getId(), viewer.getId());
    }

    private boolean isAdmin(User user) {
        return RoleUtils.isAdmin(user);
    }

    /** 한 페이지 글들의 좋아요 수를 쿼리 한 번으로 센다(글마다 count 쿼리를 날리던 N+1 대신). */
    private Map<Long, Long> countLikesByPostIds(List<Long> postIds) {
        if (postIds == null || postIds.isEmpty()) return Map.of();
        List<Object[]> rows = entityManager.createQuery(
                        "select bl.bragPost.id, count(bl) from BragLike bl where bl.bragPost.id in :ids group by bl.bragPost.id",
                        Object[].class)
                .setParameter("ids", postIds)
                .getResultList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put((Long) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }
}
