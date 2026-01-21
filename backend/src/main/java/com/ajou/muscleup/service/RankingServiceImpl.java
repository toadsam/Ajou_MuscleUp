package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterRankingListResponse;
import com.ajou.muscleup.dto.character.CharacterRankingResponse;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final UserBodyStatsRepository statsRepository;

    @Override
    @Transactional(readOnly = true)
    public CharacterRankingListResponse getCharacterRankings(String email, String type, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        long totalPublic = profileRepository.countByIsPublicTrue();
        if ("THREE_LIFT".equalsIgnoreCase(type)) {
            Integer myRank = calculateMyThreeLiftRank(email);
            Double myTopPercent = null;
            if (myRank != null && totalPublic > 0) {
                myTopPercent = Math.round((myRank * 1000.0 / totalPublic)) / 10.0;
            }
            return CharacterRankingListResponse.builder()
                    .items(fetchThreeLiftRankings(safeLimit))
                    .totalPublic(totalPublic)
                    .myRank(myRank)
                    .myTopPercent(myTopPercent)
                    .build();
        }
        if (!"LEVEL".equalsIgnoreCase(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ranking type");
        }
        Integer myRank = calculateMyLevelRank(email);
        Double myTopPercent = null;
        if (myRank != null && totalPublic > 0) {
            myTopPercent = Math.round((myRank * 1000.0 / totalPublic)) / 10.0;
        }
        return CharacterRankingListResponse.builder()
                .items(fetchLevelRankings(safeLimit))
                .totalPublic(totalPublic)
                .myRank(myRank)
                .myTopPercent(myTopPercent)
                .build();
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

    private Integer calculateMyLevelRank(String email) {
        if (email == null) return null;
        return userRepository.findByEmail(email)
                .flatMap(profileRepository::findByUser)
                .filter(CharacterProfile::isPublic)
                .map(profile -> {
                    long higher = profileRepository.countByIsPublicTrueAndLevelGreaterThan(profile.getLevel());
                    long sameAfter = profileRepository.countByIsPublicTrueAndLevelEqualsAndUpdatedAtAfter(
                            profile.getLevel(), profile.getUpdatedAt());
                    return (int) (higher + sameAfter + 1);
                })
                .orElse(null);
    }

    private Integer calculateMyThreeLiftRank(String email) {
        if (email == null) return null;
        return userRepository.findByEmail(email)
                .flatMap(user -> profileRepository.findByUser(user)
                        .filter(CharacterProfile::isPublic)
                        .flatMap(profile -> statsRepository.findByUser(user)
                                .map(stats -> {
                                    double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
                                    double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
                                    double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
                                    double total = bench + squat + deadlift;
                                    long higher = profileRepository.countPublicWithThreeLiftGreaterThan(total);
                                    long sameAfter = profileRepository.countPublicWithThreeLiftEqualsAndUpdatedAtAfter(
                                            total, profile.getUpdatedAt());
                                    return (int) (higher + sameAfter + 1);
                                })))
                .orElse(null);
    }
}
