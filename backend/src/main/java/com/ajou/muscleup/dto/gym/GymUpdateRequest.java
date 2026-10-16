package com.ajou.muscleup.dto.gym;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymVisibility;
import jakarta.validation.constraints.Pattern;
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
        Set<GymFeature> features,
        /** 라운지 모습(모임 방 광장): 기본 광장 · 실내 체육관 · 트랙 광장 · 밤 광장 · 벚꽃 광장 — 화면 components/lounge/plaza.ts PLAZA_THEMES */
        @Pattern(regexp = "PLAZA|GYM|TRACK|NIGHT|BLOSSOM", message = "라운지 모습을 다시 골라 주세요.") String mapTheme
) {}
