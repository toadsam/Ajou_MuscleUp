package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBlock;
import com.ajou.muscleup.repository.UserBlockRepository;
import com.ajou.muscleup.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 사용자 차단(이용약관 제10조 2항). 차단하면 친구 관계와 오가던 친구 요청을 끊고,
 * 서로의 자랑방 글 · 댓글이 보이지 않으며 친구 요청을 보낼 수 없다. 상대에게 알리지 않는다.
 */
@Service
@RequiredArgsConstructor
public class BlockService {
    private static final int MAX_BLOCKS = 500;

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager em;

    public record BlockedUser(Long userId, String nickname) {}

    @Transactional
    public void block(User me, Long targetId) {
        if (targetId == null || Objects.equals(me.getId(), targetId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자기 자신은 차단할 수 없어요.");
        }
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없어요."));
        if (blockRepository.findByBlocker_IdAndBlocked_Id(me.getId(), targetId).isPresent()) return;
        if (blockRepository.findAllByBlocker_IdOrderByCreatedAtDesc(me.getId()).size() >= MAX_BLOCKS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "더 차단할 수 없어요. 차단 목록을 정리해 주세요.");
        }
        blockRepository.save(UserBlock.builder().blocker(me).blocked(target).build());

        // 친구 · 친구 요청 끊기(1:1 채팅은 친구일 때만 보낼 수 있어 함께 막힌다. 지난 대화는 남긴다)
        Long a = me.getId();
        Long b = targetId;
        em.createQuery("delete from Friendship f where (f.userLow.id = :a and f.userHigh.id = :b) or (f.userLow.id = :b and f.userHigh.id = :a)")
                .setParameter("a", a).setParameter("b", b).executeUpdate();
        em.createQuery("delete from FriendRequest r where (r.requester.id = :a and r.receiver.id = :b) or (r.requester.id = :b and r.receiver.id = :a)")
                .setParameter("a", a).setParameter("b", b).executeUpdate();
    }

    @Transactional
    public void unblock(User me, Long targetId) {
        blockRepository.findByBlocker_IdAndBlocked_Id(me.getId(), targetId).ifPresent(blockRepository::delete);
    }

    @Transactional(readOnly = true)
    public List<BlockedUser> list(User me) {
        return blockRepository.findAllByBlocker_IdOrderByCreatedAtDesc(me.getId()).stream()
                .map(b -> new BlockedUser(b.getBlocked().getId(), b.getBlocked().getNickname()))
                .toList();
    }

    /** 내가 차단했거나 나를 차단한 사람 id. 쿼리의 not in 이 비지 않게 없으면 -1 하나 */
    @Transactional(readOnly = true)
    public List<Long> hiddenUserIdsForQuery(Long me) {
        List<Long> ids = new ArrayList<>(blockRepository.findHiddenUserIds(me));
        if (ids.isEmpty()) ids.add(-1L);
        return ids;
    }

    @Transactional(readOnly = true)
    public boolean blockedEitherWay(Long a, Long b) {
        return a != null && b != null && blockRepository.existsEitherWay(a, b);
    }
}
