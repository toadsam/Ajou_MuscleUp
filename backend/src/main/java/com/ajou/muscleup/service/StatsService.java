package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.dto.character.UserBodyStatsRequest;
import com.ajou.muscleup.dto.character.UserBodyStatsResponse;

public interface StatsService {
    UserBodyStatsResponse getStats(String email);

    StatsCharacterResponse upsertStats(String email, UserBodyStatsRequest request);
}
