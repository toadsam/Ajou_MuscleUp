package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.dto.character.CharacterPublicUpdateRequest;
import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;

public interface CharacterService {
    CharacterProfileResponse getOrCreateProfile(String email);

    StatsCharacterResponse evaluate(String email, CharacterEvolutionTriggerType triggerType);

    CharacterProfileResponse updatePublic(String email, CharacterPublicUpdateRequest request);
}
