package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterRankingResponse;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class RankingServiceImpl implements RankingService {
    private final CharacterProfileRepository profileRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CharacterRankingResponse> getCharacterRankings(String type, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        if ("THREE_LIFT".equalsIgnoreCase(type)) {
            return fetchThreeLiftRankings(safeLimit);
        }
        if (!"LEVEL".equalsIgnoreCase(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ranking type");
        }
        return fetchLevelRankings(safeLimit);
    }

    private List<CharacterRankingResponse> fetchLevelRankings(int limit) {
        return profileRepository.findByIsPublicTrueOrderByLevelDescUpdatedAtDesc(PageRequest.of(0, limit))
                .stream()
                .map(profile -> CharacterRankingResponse.builder()
                        .nickname(profile.getUser().getNickname())
                        .level(profile.getLevel())
                        .tier(profile.getTier())
                        .evolutionStage(profile.getEvolutionStage())
                        .title(profile.getTitle())
                        .threeLiftTotal(null)
                        .updatedAt(profile.getUpdatedAt())
                        .build())
                .toList();
    }

    private List<CharacterRankingResponse> fetchThreeLiftRankings(int limit) {
        List<Object[]> rows = profileRepository
                .findPublicWithStatsOrderByThreeLiftDesc(PageRequest.of(0, limit))
                .getContent();
        List<CharacterRankingResponse> result = new ArrayList<>();
        for (Object[] row : rows) {
            CharacterProfile profile = (CharacterProfile) row[0];
            UserBodyStats stats = (UserBodyStats) row[1];
            Double total = null;
            if (stats != null) {
                double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
                double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
                double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
                total = bench + squat + deadlift;
            }
            result.add(CharacterRankingResponse.builder()
                    .nickname(profile.getUser().getNickname())
                    .level(profile.getLevel())
                    .tier(profile.getTier())
                    .evolutionStage(profile.getEvolutionStage())
                    .title(profile.getTitle())
                    .threeLiftTotal(total)
                    .updatedAt(profile.getUpdatedAt())
                    .build());
        }
        return result;
    }
}
