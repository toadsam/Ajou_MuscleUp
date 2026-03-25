package com.ajou.muscleup.dto.character;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StatsCharacterResponse {
    private UserBodyStatsResponse stats;
    private CharacterProfileResponse character;
    private CharacterEvaluationResponse evaluation;
    private CharacterChangeResponse change;
}
