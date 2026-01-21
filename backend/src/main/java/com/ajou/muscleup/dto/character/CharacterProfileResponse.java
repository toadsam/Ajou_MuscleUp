package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
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
    @JsonProperty("isPublic")
    private boolean isPublic;
    private LocalDateTime lastEvaluatedAt;
    private LocalDateTime updatedAt;

    public static CharacterProfileResponse from(CharacterProfile profile) {
        return CharacterProfileResponse.builder()
                .level(profile.getLevel())
                .tier(profile.getTier())
                .evolutionStage(profile.getEvolutionStage())
                .title(profile.getTitle())
                .isPublic(profile.isPublic())
                .lastEvaluatedAt(profile.getLastEvaluatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
