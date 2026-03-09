package com.ajou.muscleup.dto.friend;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendCharacterResponse {
    private CharacterTier tier;
    private Integer evolutionStage;
    private Integer level;
    private String avatarSeed;

    public static FriendCharacterResponse from(CharacterProfile profile) {
        if (profile == null) {
            return null;
        }
        return FriendCharacterResponse.builder()
                .tier(profile.getTier())
                .evolutionStage(profile.getEvolutionStage())
                .level(profile.getLevel())
                .avatarSeed(profile.getAvatarSeed())
                .build();
    }
}
