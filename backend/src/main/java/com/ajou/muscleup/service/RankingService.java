package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterRankingListResponse;

public interface RankingService {
    CharacterRankingListResponse getCharacterRankings(String email, String type, int limit);

    /** gymSlug 가 있으면 그 짐 멤버 중 공개 캐릭터만으로 순위를 매긴다(멤버만 볼 수 있음). */
    CharacterRankingListResponse getCharacterRankings(String email, String type, int limit, String gymSlug);
}
