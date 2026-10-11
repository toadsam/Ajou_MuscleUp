package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.util.RoleUtils;
import java.util.Objects;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 짐(모임) 안 권한을 한 곳에서 판단한다(docs/design/stage0-gyms.md §1 "역할" 표).
 *
 * | 할 일             | OWNER | STAFF | MEMBER |
 * | SETTINGS · STAFF  |   ✔   |       |        |
 * | MEMBERS · CONTENT |   ✔   |   ✔   |        |
 * | VIEW_MEMBERS      |   ✔   |   ✔   |   ✔    |
 *
 * 앱 운영자(ROLE_ADMIN)는 모든 짐에서 모든 일을 할 수 있다(신고 · 남용 대응).
 * 짐 주인은 WorkoutCrew.owner 가 기준이다(멤버 행의 역할이 어긋나 있어도 주인으로 본다).
 */
@Service
@RequiredArgsConstructor
public class GymPermissionService {

    public enum GymAction {
        /** 이름 · 설명 · 공개 범위 · 기능 스위치 · 삭제/보관 */
        MANAGE_SETTINGS,
        /** 운영진 임명 · 해임 · 운영진 내보내기 */
        MANAGE_STAFF,
        /** 가입 승인 · 거절 · 멤버 내보내기 */
        MANAGE_MEMBERS,
        /** 챌린지 · 소식 · 이벤트 · 공동구매 관리 */
        MANAGE_CONTENT,
        /** 멤버 목록 · 개인별 출석 보기 */
        VIEW_MEMBERS
    }

    private final WorkoutCrewMemberRepository memberRepository;

    /** 이 짐에서 내 역할. 멤버가 아니면 빈 값 */
    public Optional<WorkoutCrewMemberRole> roleOf(WorkoutCrew gym, User user) {
        if (gym == null || user == null) return Optional.empty();
        if (gym.getOwner() != null && Objects.equals(gym.getOwner().getId(), user.getId())) {
            return Optional.of(WorkoutCrewMemberRole.OWNER);
        }
        return memberRepository.findByCrewAndUser(gym, user).map(WorkoutCrewMember::getRole);
    }

    public boolean can(User user, WorkoutCrew gym, GymAction action) {
        if (RoleUtils.isAdmin(user)) return true;
        return roleOf(gym, user).map(role -> allows(role, action)).orElse(false);
    }

    public void require(User user, WorkoutCrew gym, GymAction action) {
        if (!can(user, gym, action)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, messageFor(action));
        }
    }

    static boolean allows(WorkoutCrewMemberRole role, GymAction action) {
        return switch (action) {
            case MANAGE_SETTINGS, MANAGE_STAFF -> role == WorkoutCrewMemberRole.OWNER;
            case MANAGE_MEMBERS, MANAGE_CONTENT -> role == WorkoutCrewMemberRole.OWNER || role == WorkoutCrewMemberRole.STAFF;
            case VIEW_MEMBERS -> true;
        };
    }

    private static String messageFor(GymAction action) {
        return switch (action) {
            case MANAGE_SETTINGS, MANAGE_STAFF -> "모임장만 할 수 있어요.";
            case MANAGE_MEMBERS, MANAGE_CONTENT -> "모임장이나 운영진만 할 수 있어요.";
            case VIEW_MEMBERS -> "모임 멤버만 볼 수 있어요.";
        };
    }
}
