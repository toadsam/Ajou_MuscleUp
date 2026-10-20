package com.ajou.muscleup.dto.friend;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.service.AvatarLookService;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FriendCharacterResponse {
    private CharacterTier tier;
    private Integer evolutionStage;
    private Integer level;
    private String avatarSeed;
    private Gender gender;
    @JsonProperty("isResting")
    private boolean isResting;
    /** 도감에서 장착한 민소매 색 · 칭호(없으면 null) */
    private String tank;
    private String title;
    /** 운동 직후 펌핑 중 */
    @JsonProperty("isPumped")
    private boolean isPumped;
    /** 몸 단계 0~5(AvatarLookService) */
    private int bodyStage;

    public static FriendCharacterResponse from(CharacterProfile profile) {
        return from(profile, null);
    }

    public static FriendCharacterResponse from(CharacterProfile profile, AvatarLookService.Look look) {
        if (profile == null) {
            return null;
        }
        return FriendCharacterResponse.builder()
                .tier(profile.getTier())
                .evolutionStage(profile.getEvolutionStage())
                .level(profile.getLevel())
                .avatarSeed(profile.getAvatarSeed())
                .gender(profile.getGender())
                .isResting(profile.isResting())
                .tank(look == null ? null : look.tank())
                .title(look == null ? null : look.title())
                .isPumped(look != null && look.pumped(System.currentTimeMillis()))
                .bodyStage(look == null ? 0 : look.bodyStage())
                .build();
    }
}
