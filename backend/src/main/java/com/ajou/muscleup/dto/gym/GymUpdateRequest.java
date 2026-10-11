package com.ajou.muscleup.dto.gym;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymVisibility;
import jakarta.validation.constraints.Size;
import java.util.Set;

/** 보낸 칸만 바꾼다(null 은 그대로). */
public record GymUpdateRequest(
        @Size(min = 1, max = 60) String name,
        @Size(max = 300) String description,
        GymVisibility visibility,
        CrewJoinPolicy joinPolicy,
        @Size(max = 40) String region,
        @Size(max = 500) String logoUrl,
        Set<GymFeature> features
) {}
