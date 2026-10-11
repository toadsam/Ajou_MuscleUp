package com.ajou.muscleup.dto.gym;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.GymVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record GymCreateRequest(
        @NotBlank @Size(max = 60) String name,
        @NotBlank @Pattern(regexp = GymCreateRequest.SLUG_PATTERN, message = "주소는 영문 소문자 · 숫자 · 하이픈 3~40자로 적어 주세요.") String slug,
        @NotNull GymType type,
        GymVisibility visibility,
        CrewJoinPolicy joinPolicy,
        @Size(max = 300) String description,
        @Size(max = 60) String schoolDomain,
        @Size(max = 40) String region
) {
    public static final String SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$";
}
