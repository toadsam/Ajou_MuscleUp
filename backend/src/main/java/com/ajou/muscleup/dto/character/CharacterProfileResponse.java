package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterProfileResponse {
    private int level;
    private CharacterTier tier;
    private int evolutionStage;
    private String title;
    private String avatarSeed;
    private String stylePreset;
    private Gender gender;
    private GrowthParamsResponse growthParams;
    @JsonProperty("isPublic")
    private boolean isPublic;
    @JsonProperty("isResting")
    private boolean isResting;
    private LocalDateTime lastEvaluatedAt;
    private LocalDateTime updatedAt;

    public static CharacterProfileResponse from(CharacterProfile profile, GrowthParamsResponse growthParams) {
        return CharacterProfileResponse.builder()
                .level(profile.getLevel())
                .tier(profile.getTier())
                .evolutionStage(profile.getEvolutionStage())
                .title(profile.getTitle())
                .avatarSeed(profile.getAvatarSeed())
                .stylePreset(profile.getStylePreset())
                .gender(profile.getGender())
                .growthParams(growthParams)
                .isPublic(profile.isPublic())
                .isResting(profile.isResting())
                .lastEvaluatedAt(profile.getLastEvaluatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
