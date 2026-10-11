package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragPostCreateRequest;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import com.ajou.muscleup.dto.brag.BragPostUpdateRequest;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
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
    private final BragAccess bragAccess;
    private final GymScope gymScope;
    private final BlockService blockService;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public BragPostResponse create(String userEmail, BragPostCreateRequest req) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        List<String> media = req.getMediaUrls() == null
                ? new ArrayList<String>()  // Hibernate 가 비우고 채울 수 있게(List.of() 는 병합 시 오류)
                : req.getMediaUrls().stream()
                .filter(url -> url != null && !url.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(ArrayList::new));

        BragVisibility visibility = req.getVisibility() == null ? BragVisibility.PUBLIC : req.getVisibility();
        WorkoutCrew gym = bragAccess.resolveGym(req.getGymSlug(), visibility, user);
        BragPost saved = bragPostRepository.save(BragPost.builder()
                .user(user)
                .title(req.getTitle().trim())
                .content(req.getContent().trim())
                .movement(req.getMovement() == null ? null : req.getMovement().trim())
                .weight(req.getWeight() == null ? null : req.getWeight().trim())
                .mediaUrls(media)
                .visibility(visibility)
                .gym(gym)
                .build());

        return BragPostResponse.from(saved, 0L, user.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BragPostResponse> list(String userEmail, String gymSlug, Pageable pageable) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        List<Long> friendIds = new ArrayList<>(friendService.findFriendIds(user.getId()));
        if (friendIds.isEmpty()) friendIds.add(-1L);
        // 내가 차단했거나 나를 차단한 사람의 글은 어디에도 보이지 않는다
        List<Long> hidden = blockService.hiddenUserIdsForQuery(user.getId());
        Page<BragPost> posts;
        if (gymSlug == null || gymSlug.isBlank()) {
            posts = bragPostRepository.findSquareFeed(
                    user.getId(), hidden, friendIds, BragVisibility.PUBLIC, BragVisibility.FRIENDS, pageable);
        } else {
            // 닫힌 짐은 멤버만(모르는 사람에겐 404). 열린 짐은 누구나 보되, "우리 모임만" 글은 멤버에게만
            WorkoutCrew gym = gymScope.visibleOrThrow(gymSlug, user, null);
            boolean member = isAdmin(user) || gymScope.isMember(gym, user);
            posts = bragPostRepository.findGymFeed(gym.getId(), user.getId(), hidden, friendIds,
                    BragVisibility.PUBLIC, member ? BragVisibility.GYM : BragVisibility.PUBLIC, BragVisibility.FRIENDS,
                    pageable);
        }
        Map<Long, Long> likeCounts = countLikesByPostIds(posts.getContent().stream().map(BragPost::getId).toList());
        return posts.map(p -> BragPostResponse.from(p, likeCounts.getOrDefault(p.getId(), 0L), user.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public BragPostResponse get(Long id, String userEmail) {
        User viewer = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        BragPost post = bragPostRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        bragAccess.requireView(post, viewer);
        long likes = bragLikeRepository.countByPostId(id);
        return BragPostResponse.from(post, likes, viewer.getId());
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
                ? new ArrayList<String>()  // Hibernate 가 비우고 채울 수 있게(List.of() 는 병합 시 오류)
                : req.getMediaUrls().stream()
                .filter(url -> url != null && !url.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(ArrayList::new));

        post.setTitle(req.getTitle().trim());
        post.setContent(req.getContent().trim());
        post.setMovement(req.getMovement() == null ? null : req.getMovement().trim());
        post.setWeight(req.getWeight() == null ? null : req.getWeight().trim());
        post.setMediaUrls(media);
        // 보내지 않은 칸은 원래 값 그대로(예전 화면이 공개 범위 · 짐을 안 보내도 글이 광장으로 옮겨지지 않게).
        // gymSlug 를 빈 문자열로 보내면 광장으로 옮긴다.
        BragVisibility visibility = req.getVisibility() != null ? req.getVisibility()
                : post.getVisibility() != null ? post.getVisibility() : BragVisibility.PUBLIC;
        // 짐을 그대로 두면 다시 확인하지 않는다(운영자가 남의 글을 고칠 때). 새로 고르거나 바꾸면 그 짐 멤버여야 한다
        String currentSlug = post.getGym() != null ? post.getGym().getSlug() : null;
        boolean sameGym = req.getGymSlug() == null
                ? true
                : currentSlug != null && req.getGymSlug().trim().equalsIgnoreCase(currentSlug);
        WorkoutCrew gym = sameGym ? post.getGym() : bragAccess.resolveGym(req.getGymSlug(), visibility, user);
        if (gym == null && visibility == BragVisibility.GYM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "어느 모임에 올릴지 골라 주세요.");
        }
        post.setVisibility(visibility);
        post.setGym(gym);

        BragPost saved = bragPostRepository.save(post);
        long likes = bragLikeRepository.countByPostId(id);
        return BragPostResponse.from(saved, likes, user.getId());
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
