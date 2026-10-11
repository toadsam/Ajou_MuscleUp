package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.GroupBuyVisibility;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.util.RoleUtils;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 공동구매를 누가 보고 · 열 수 있는지. 설계: docs/design/stage0-gyms.md §2-1.
 *
 * - 보기: 전체 모집(PUBLIC) · 짐 없는 글은 로그인한 누구나, 우리 모임만(GYM)은 그 짐 멤버 · 작성자 · 앱 운영자.
 *   못 보는 글은 없는 것처럼 404.
 * - 열기: 짐에서 열면 그 짐 멤버여야 하고(짐이 운영 중 · 공동구매 기능 켜짐), 전체 모집은 모르는 사람과 돈이 오가므로
 *   가입 N일 · 운동 N일 이상(앱 운영자는 예외). 기준은 app.group-buy.* 로 조정.
 */
@Component
@RequiredArgsConstructor
public class GroupBuyAccess {
    private final GymPermissionService permissions;
    private final WorkoutCrewMemberRepository memberRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final Clock clock;

    @Value("${app.group-buy.public-min-member-days:7}")
    private int publicMinMemberDays;

    @Value("${app.group-buy.public-min-workout-days:3}")
    private int publicMinWorkoutDays;

    public boolean canView(Protein p, User viewer) {
        if (viewer == null) return false;
        if (RoleUtils.isAdmin(viewer)) return true;
        if (p.getOwner() != null && Objects.equals(p.getOwner().getId(), viewer.getId())) return true;
        if (p.visibilityOrDefault() == GroupBuyVisibility.PUBLIC || p.getGym() == null) return true;
        return permissions.roleOf(p.getGym(), viewer).isPresent();
    }

    public void requireView(Protein p, User viewer) {
        if (!canView(p, viewer)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공동구매 글을 찾을 수 없어요.");
        }
    }

    /** 내가 속한 짐 id(목록 거르기용). 비어 있으면 쿼리용으로 -1 하나 */
    public List<Long> myGymIdsForQuery(User viewer) {
        List<Long> ids = viewer == null ? List.of() : memberRepository.findCrewIdsByUserId(viewer.getId());
        return ids.isEmpty() ? List.of(-1L) : ids;
    }

    public void requireCanOpen(User owner, WorkoutCrew gym, GroupBuyVisibility visibility) {
        boolean admin = RoleUtils.isAdmin(owner);
        if (gym != null && !admin) {
            if (permissions.roleOf(gym, owner).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "그 모임 멤버만 공동구매를 열 수 있어요.");
            }
            if (gym.statusOrDefault() != GymStatus.ACTIVE || !gym.getFeatures().contains(GymFeature.GROUP_BUY)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 모임은 공동구매를 쓰지 않아요.");
            }
        }
        if (visibility == GroupBuyVisibility.PUBLIC && !admin) {
            if (memberDays(owner) < publicMinMemberDays || workoutDays(owner) < publicMinWorkoutDays) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "전체 모집은 가입 " + publicMinMemberDays + "일 · 운동 " + publicMinWorkoutDays
                                + "일 이후에 열 수 있어요. 지금은 우리 모임 안에서만 열 수 있어요.");
            }
        }
    }

    /** 가입하고 지난 날(가입 시각이 없는 예전 계정은 충분히 오래된 것으로 본다) */
    public long memberDays(User user) {
        LocalDateTime created = user.getCreatedAt();
        if (created == null) return Long.MAX_VALUE / 2;
        return ChronoUnit.DAYS.between(created.toLocalDate(), LocalDate.now(clock));
    }

    /** 누적 운동 일수(출석에서 "운동했다" 로 기록한 날) */
    public long workoutDays(User user) {
        return attendanceLogRepository.countByUserAndDidWorkoutTrueAndDateBetween(user, LocalDate.of(2000, 1, 1), LocalDate.now(clock));
    }
}
