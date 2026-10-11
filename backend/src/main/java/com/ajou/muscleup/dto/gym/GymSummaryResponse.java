package com.ajou.muscleup.dto.gym;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.GymVisibility;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import java.util.Set;
import lombok.Builder;

/** 짐 정보. inviteCode 는 멤버에게만 채운다. myRole 은 멤버가 아니면 null. */
@Builder
public record GymSummaryResponse(
        Long id,
        String slug,
        String name,
        String description,
        GymType type,
        GymVisibility visibility,
        GymStatus status,
        String schoolDomain,
        String region,
        String logoUrl,
        String mapTheme,
        String parentSlug,
        CrewJoinPolicy joinPolicy,
        Set<GymFeature> features,
        long memberCount,
        boolean joined,
        WorkoutCrewMemberRole myRole,
        String inviteCode
) {}
