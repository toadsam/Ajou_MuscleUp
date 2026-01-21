package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterRankingListResponse;

public interface RankingService {
    CharacterRankingListResponse getCharacterRankings(String email, String type, int limit);
}
