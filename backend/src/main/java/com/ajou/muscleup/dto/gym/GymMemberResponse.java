package com.ajou.muscleup.dto.gym;

import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import java.time.LocalDateTime;

/** 짐 멤버. 이메일은 싣지 않는다. */
public record GymMemberResponse(Long userId, String nickname, WorkoutCrewMemberRole role, String title, LocalDateTime joinedAt) {}
