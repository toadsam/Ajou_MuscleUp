package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.dto.character.UserBodyStatsRequest;
import com.ajou.muscleup.dto.character.UserBodyStatsResponse;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class StatsServiceImpl implements StatsService {
    private final UserRepository userRepository;
    private final UserBodyStatsRepository statsRepository;
    private final CharacterServiceImpl characterService;

    @Override
    @Transactional(readOnly = true)
    public UserBodyStatsResponse getStats(String email) {
        User user = getUserOrThrow(email);
        return statsRepository.findByUser(user)
                .map(UserBodyStatsResponse::from)
                .orElse(UserBodyStatsResponse.builder()
                        .heightCm(null)
                        .gender(null)
                        .weightKg(null)
                        .skeletalMuscleKg(null)
                        .bodyFatPercent(null)
                        .mbti(null)
                        .benchKg(null)
                        .squatKg(null)
                        .deadliftKg(null)
                        .updatedAt(null)
                        .build());
    }

    @Override
    @Transactional
    public StatsCharacterResponse upsertStats(String email, UserBodyStatsRequest request) {
        User user = getUserOrThrow(email);
        if (request.getWeightKg() == null || request.getWeightKg() < 20 || request.getWeightKg() > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weightKg must be between 20 and 300");
        }

        UserBodyStats stats = statsRepository.findByUser(user)
                .orElseGet(() -> UserBodyStats.builder().user(user).build());

        stats.setHeightCm(request.getHeightCm());
        stats.setGender(request.getGender() != null ? request.getGender() : Gender.MALE);
        stats.setWeightKg(request.getWeightKg());
        stats.setSkeletalMuscleKg(request.getSkeletalMuscleKg());
        stats.setBodyFatPercent(request.getBodyFatPercent());
        stats.setMbti(request.getMbti() == null ? null : request.getMbti().toUpperCase(Locale.ROOT));
        stats.setBenchKg(request.getBenchKg());
        stats.setSquatKg(request.getSquatKg());
        stats.setDeadliftKg(request.getDeadliftKg());

        UserBodyStats saved = statsRepository.save(stats);
        return characterService.evaluateAndUpdate(user, saved, CharacterEvolutionTriggerType.STATS_UPDATED);
    }

    private User getUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    }
}
