package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterRankingResponse;
import java.util.List;

public interface RankingService {
    List<CharacterRankingResponse> getCharacterRankings(String type, int limit);
}
