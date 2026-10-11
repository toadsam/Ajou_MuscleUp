package com.ajou.muscleup.dto.gym;

import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 운영진 임명(STAFF) · 해임(MEMBER) · 직함. 모임장(OWNER) 넘기기는 아직 없음. */
public record GymMemberRoleRequest(@NotNull WorkoutCrewMemberRole role, @Size(max = 20) String title) {}
