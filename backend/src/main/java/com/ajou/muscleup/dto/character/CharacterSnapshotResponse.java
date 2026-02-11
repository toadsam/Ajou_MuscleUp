package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterSnapshotResponse {
    private int level;
    private CharacterTier tier;
    private int evolutionStage;
    private String title;
    private String avatarSeed;
    private String stylePreset;

    public static CharacterSnapshotResponse from(CharacterProfile profile) {
        return CharacterSnapshotResponse.builder()
                .level(profile.getLevel())
                .tier(profile.getTier())
                .evolutionStage(profile.getEvolutionStage())
                .title(profile.getTitle())
                .avatarSeed(profile.getAvatarSeed())
                .stylePreset(profile.getStylePreset())
                .build();
    }
}
