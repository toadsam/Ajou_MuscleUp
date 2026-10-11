package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.util.RoleUtils;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 자랑방 글을 누가 볼 수 있나(글 · 댓글 · 좋아요 공통). 설계: docs/design/stage0-gyms.md §2.
 *
 * - PUBLIC: 로그인한 누구나 / FRIENDS: 작성자의 친구 / GYM: 글을 올린 짐(모임)의 멤버
 * - 작성자 본인과 앱 운영자(신고 · 남용 대응)는 항상 본다.
 */
@Component
@RequiredArgsConstructor
public class BragAccess {
    private final FriendService friendService;
    private final GymScope gymScope;

    public boolean canView(BragPost post, User viewer) {
        if (viewer == null) return false;
        if (post.getUser() != null && Objects.equals(post.getUser().getId(), viewer.getId())) return true;
        if (RoleUtils.isAdmin(viewer)) return true;
        BragVisibility visibility = post.getVisibility() == null ? BragVisibility.PUBLIC : post.getVisibility();
        return switch (visibility) {
            case PUBLIC -> true;
            case FRIENDS -> post.getUser() != null && friendService.areFriends(post.getUser().getId(), viewer.getId());
            case GYM -> post.getGym() != null && gymScope.isMember(post.getGym(), viewer);
        };
    }

    public void requireView(BragPost post, User viewer) {
        if (canView(post, viewer)) return;
        String message = post.getVisibility() == BragVisibility.GYM ? "모임 멤버에게만 공개된 글이에요." : "친구 공개 게시글입니다.";
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    /**
     * 글을 어느 짐에 올릴지 정한다. 짐을 고르면 그 짐 멤버여야 하고, "우리 모임만"(GYM)은 짐이 꼭 있어야 한다.
     * 짐 없이 PUBLIC · FRIENDS 로 쓰면 광장에만 올라간다.
     */
    public WorkoutCrew resolveGym(String gymSlug, BragVisibility visibility, User author) {
        boolean noGym = gymSlug == null || gymSlug.isBlank();
        if (noGym) {
            if (visibility == BragVisibility.GYM) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "어느 모임에 올릴지 골라 주세요.");
            }
            return null;
        }
        return gymScope.postableOrThrow(gymSlug, author);
    }
}
