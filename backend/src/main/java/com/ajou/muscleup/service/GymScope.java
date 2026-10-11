package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.ajou.muscleup.util.RoleUtils;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * "이 글 · 소식은 어느 짐 것이고, 누가 볼 수 있나"를 한 곳에서 정한다(0단계 PR 6-2, 설계 docs/design/stage0-gyms.md §2).
 *
 * - 열린 짐: 운영 중(ACTIVE)이고 비공개(PRIVATE)가 아닌 짐. 누구나(로그인 없이도) 그 짐 소식을 볼 수 있다.
 * - 닫힌 짐(비공개 · 승인 전 · 보관): 멤버와 앱 운영자만. 모르는 사람에겐 없는 것처럼 404.
 * - 짐에 글을 올리기: 운영 중인 짐의 멤버(앱 운영자 포함).
 */
@Component
@RequiredArgsConstructor
public class GymScope {
    private final WorkoutCrewRepository gymRepository;
    private final WorkoutCrewMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final GymPermissionService permissions;

    public WorkoutCrew gymOrThrow(String slug) {
        return gymRepository.findBySlug(slug == null ? "" : slug.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요."));
    }

    public boolean isOpen(WorkoutCrew gym) {
        return gym.statusOrDefault() == GymStatus.ACTIVE && gym.visibilityOrDefault() != GymVisibility.PRIVATE;
    }

    /** 멤버(주인 포함)인가. 앱 운영자는 따로 본다 */
    public boolean isMember(WorkoutCrew gym, User user) {
        return permissions.roleOf(gym, user).isPresent();
    }

    public boolean canSee(WorkoutCrew gym, User viewer) {
        if (gym == null || isOpen(gym)) return true;
        return viewer != null && (RoleUtils.isAdmin(viewer) || isMember(gym, viewer));
    }

    /** 주소(slug)로 짐을 찾고 볼 수 있는지 확인. 맞는 초대 코드가 있으면 보관되지 않은 닫힌 짐도 볼 수 있다 */
    public WorkoutCrew visibleOrThrow(String slug, User viewer, String inviteCode) {
        WorkoutCrew gym = gymOrThrow(slug);
        if (canSee(gym, viewer)) return gym;
        boolean invited = inviteCode != null && !inviteCode.isBlank() && inviteCode.trim().equals(gym.getInviteCode())
                && gym.statusOrDefault() != GymStatus.ARCHIVED;
        if (invited) return gym;
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요.");
    }

    /** 이 짐에 글을 올릴 수 있는 사람만 통과(운영 중인 짐의 멤버 · 앱 운영자) */
    public WorkoutCrew postableOrThrow(String slug, User user) {
        WorkoutCrew gym = gymOrThrow(slug);
        boolean admin = user != null && RoleUtils.isAdmin(user);
        if (!admin && (user == null || !isMember(gym, user))) {
            if (!canSee(gym, user)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요.");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "그 모임 멤버만 올릴 수 있어요.");
        }
        if (!admin && gym.statusOrDefault() != GymStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "운영 중인 모임에만 올릴 수 있어요.");
        }
        return gym;
    }

    /** 내가 속한 짐 id. 쿼리의 in 절이 비지 않게, 없으면 -1 하나 */
    public List<Long> myGymIdsForQuery(User viewer) {
        List<Long> ids = viewer == null ? List.of() : memberRepository.findCrewIdsByUserId(viewer.getId());
        return ids.isEmpty() ? List.of(-1L) : ids;
    }

    /** permitAll 경로에서 비로그인이면 principal 이 null 이거나 "anonymousUser" 문자열이다. */
    public User findUser(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) return null;
        return userRepository.findByEmail(email).orElse(null);
    }
}
