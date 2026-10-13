package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.friend.FriendCharacterResponse;
import com.ajou.muscleup.entity.GymGuestbookEntry;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.push.PushService;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.GymGuestbookRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 친구 헬스장 구경 · 방명록.
 * - 친구(서로 차단 안 함)만 구경하고 방명록을 남긴다. 친구가 아니면 있는지도 알려 주지 않는다(404).
 * - 방명록은 한 줄 60자, 같은 친구 헬스장에 24시간 동안 3개까지. 남기면 주인에게 "응원" 종류 알림(끌 수 있음).
 * - 보이는 사람: 주인, 주인의 친구. 나와 서로 차단한 사람의 글은 빼고 보여 준다.
 * - 지우기: 주인(내 헬스장 글 전부) · 쓴 사람(자기 글).
 * - 응답에 이메일을 싣지 않는다(닉네임 · 사용자 번호만).
 */
@Service
@RequiredArgsConstructor
public class GymVisitService {
    static final int MAX_LENGTH = 60;
    static final int PER_DAY = 3;
    private static final int LIST_SIZE = 30;

    private final UserRepository userRepository;
    private final CharacterProfileRepository characterProfileRepository;
    private final GymGuestbookRepository guestbookRepository;
    private final GymDecorService gymDecorService;
    private final FriendService friendService;
    private final BlockService blockService;
    private final AvatarLookService avatarLookService;
    private final ApplicationEventPublisher events;

    public record EntryView(Long id, Long authorId, String nickname, String message, LocalDateTime createdAt,
                            boolean mine, boolean canDelete) {}

    public record FriendGym(Long userId, String nickname, FriendCharacterResponse character,
                            List<GymDecorService.SlotView> slots, List<EntryView> guestbook) {}

    @Transactional(readOnly = true)
    public FriendGym friendGym(User me, Long ownerId) {
        User owner = friendOrThrow(me, ownerId);
        FriendCharacterResponse character = characterProfileRepository.findByUser(owner)
                .map(p -> FriendCharacterResponse.from(p, avatarLookService.look(owner.getId())))
                .orElse(null);
        return new FriendGym(owner.getId(), owner.getNickname(), character, gymDecorService.slotsOf(owner), entries(me, owner));
    }

    /** 내 헬스장 방명록 */
    @Transactional(readOnly = true)
    public List<EntryView> myGuestbook(User me) {
        return entries(me, me);
    }

    @Transactional
    public EntryView write(User me, Long ownerId, String raw) {
        User owner = friendOrThrow(me, ownerId);
        String message = raw == null ? "" : raw.strip().replaceAll("\\s+", " ");
        if (message.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "한 줄 남겨 주세요.");
        if (message.codePointCount(0, message.length()) > MAX_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "방명록은 " + MAX_LENGTH + "자까지 쓸 수 있어요.");
        }
        long recent = guestbookRepository.countByOwner_IdAndAuthor_IdAndCreatedAtAfter(owner.getId(), me.getId(),
                LocalDateTime.now().minusHours(24));
        if (recent >= PER_DAY) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "같은 친구 헬스장에는 하루 " + PER_DAY + "개까지 남길 수 있어요.");
        }
        GymGuestbookEntry entry = guestbookRepository.save(GymGuestbookEntry.builder().owner(owner).author(me).message(message).build());
        events.publishEvent(new PushService.PushEvent(owner.getId(), PushService.Type.SOCIAL,
                new PushService.Message("헬스장 방명록", me.getNickname() + "님이 내 헬스장에 다녀갔어요.", "/", "guestbook")));
        return view(me, owner, entry);
    }

    @Transactional
    public void delete(User me, Long entryId) {
        GymGuestbookEntry entry = guestbookRepository.findById(entryId)
                .filter(e -> e.getOwner().getId().equals(me.getId()) || e.getAuthor().getId().equals(me.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "방명록 글을 찾을 수 없어요."));
        guestbookRepository.delete(entry);
    }

    private List<EntryView> entries(User viewer, User owner) {
        Set<Long> hidden = new HashSet<>(blockService.hiddenUserIdsForQuery(viewer.getId()));
        return guestbookRepository.findByOwner_IdOrderByIdDesc(owner.getId(), PageRequest.of(0, LIST_SIZE)).stream()
                .filter(e -> !hidden.contains(e.getAuthor().getId()))
                .map(e -> view(viewer, owner, e))
                .toList();
    }

    private static EntryView view(User viewer, User owner, GymGuestbookEntry e) {
        boolean mine = e.getAuthor().getId().equals(viewer.getId());
        return new EntryView(e.getId(), e.getAuthor().getId(), e.getAuthor().getNickname(), e.getMessage(), e.getCreatedAt(),
                mine, mine || owner.getId().equals(viewer.getId()));
    }

    private User friendOrThrow(User me, Long ownerId) {
        if (ownerId == null || ownerId.equals(me.getId())
                || !friendService.areFriends(me.getId(), ownerId)
                || blockService.blockedEitherWay(me.getId(), ownerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "친구의 헬스장만 구경할 수 있어요.");
        }
        return userRepository.findById(ownerId)
                .filter(u -> !u.isDeleted())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "친구의 헬스장만 구경할 수 있어요."));
    }
}
