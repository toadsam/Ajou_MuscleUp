package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.character.CharacterEvaluationResponse;
import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.dto.character.CharacterPublicUpdateRequest;
import com.ajou.muscleup.dto.character.CharacterSnapshotResponse;
import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.dto.character.UserBodyStatsResponse;
import com.ajou.muscleup.entity.CharacterEvolutionHistory;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.CharacterEvolutionHistoryRepository;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CharacterServiceImpl implements CharacterService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final UserRepository userRepository;
    private final UserBodyStatsRepository statsRepository;
    private final CharacterProfileRepository profileRepository;
    private final CharacterEvolutionHistoryRepository historyRepository;

    @Override
    @Transactional
    public CharacterProfileResponse getOrCreateProfile(String email) {
        User user = getUserOrThrow(email);
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user)));
        return CharacterProfileResponse.from(profile);
    }

    @Override
    @Transactional
    public StatsCharacterResponse evaluate(String email, CharacterEvolutionTriggerType triggerType) {
        User user = getUserOrThrow(email);
        UserBodyStats stats = statsRepository.findByUser(user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stats not found"));

        return evaluateAndUpdate(user, stats, triggerType);
    }

    @Override
    @Transactional
    public CharacterProfileResponse updatePublic(String email, CharacterPublicUpdateRequest request) {
        User user = getUserOrThrow(email);
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user)));
        profile.setPublic(Boolean.TRUE.equals(request.getIsPublic()));
        return CharacterProfileResponse.from(profileRepository.save(profile));
    }

    @Transactional
    public StatsCharacterResponse evaluateAndUpdate(User user, UserBodyStats stats, CharacterEvolutionTriggerType triggerType) {
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user)));
        CharacterSnapshotResponse beforeSnapshot = CharacterSnapshotResponse.from(profile);

        CharacterEvaluationResponse evaluation = evaluateStats(stats);
        profile.setLevel(evaluation.getLevel());
        profile.setTier(evaluation.getTier());
        profile.setEvolutionStage(evaluation.getEvolutionStage());
        profile.setTitle(evaluation.getTitle());
        profile.setLastEvaluatedAt(LocalDateTime.now(KST));
        CharacterProfile saved = profileRepository.save(profile);

        CharacterSnapshotResponse afterSnapshot = CharacterSnapshotResponse.from(saved);
        CharacterChangeResponse change = CharacterChangeResponse.builder()
                .leveledUp(afterSnapshot.getLevel() > beforeSnapshot.getLevel())
                .evolved(afterSnapshot.getEvolutionStage() > beforeSnapshot.getEvolutionStage())
                .tierChanged(afterSnapshot.getTier() != beforeSnapshot.getTier())
                .before(beforeSnapshot)
                .after(afterSnapshot)
                .build();

        if (change.isLeveledUp() || change.isEvolved() || change.isTierChanged()) {
            historyRepository.save(CharacterEvolutionHistory.builder()
                    .user(user)
                    .triggerType(triggerType)
                    .beforeLevel(beforeSnapshot.getLevel())
                    .afterLevel(afterSnapshot.getLevel())
                    .beforeTier(beforeSnapshot.getTier())
                    .afterTier(afterSnapshot.getTier())
                    .beforeStage(beforeSnapshot.getEvolutionStage())
                    .afterStage(afterSnapshot.getEvolutionStage())
                    .build());
        }

        return StatsCharacterResponse.builder()
                .stats(UserBodyStatsResponse.from(stats))
                .character(CharacterProfileResponse.from(saved))
                .evaluation(evaluation)
                .change(change)
                .build();
    }

    private CharacterEvaluationResponse evaluateStats(UserBodyStats stats) {
        double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
        double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
        double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
        double weight = stats.getWeightKg() == null ? 0.0 : stats.getWeightKg();
        if (weight < 20 || weight > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weightKg must be between 20 and 300");
        }

        double threeLiftTotal = bench + squat + deadlift;
        double strengthRatio = weight > 0 ? threeLiftTotal / weight : 0.0;
        double base = clamp(strengthRatio * 20.0, 0.0, 60.0);

        double muscleBonus = 0.0;
        if (stats.getSkeletalMuscleKg() != null && weight > 0) {
            muscleBonus = clamp((stats.getSkeletalMuscleKg() / weight) * 20.0, 0.0, 20.0);
        }

        double totalScore = clamp(base + muscleBonus, 0.0, 100.0);
        int level = 1 + (int) Math.floor(totalScore / 5.0);
        CharacterTier tier = resolveTier(totalScore);
        int stage = resolveStage(level);
        String title = resolveTitle(stage);

        return CharacterEvaluationResponse.builder()
                .threeLiftTotal(roundOneDecimal(threeLiftTotal))
                .strengthRatio(roundTwoDecimals(strengthRatio))
                .totalScore(roundTwoDecimals(totalScore))
                .level(level)
                .tier(tier)
                .evolutionStage(stage)
                .title(title)
                .build();
    }

    private CharacterTier resolveTier(double totalScore) {
        if (totalScore >= 85.0) return CharacterTier.DIAMOND;
        if (totalScore >= 70.0) return CharacterTier.PLATINUM;
        if (totalScore >= 50.0) return CharacterTier.GOLD;
        if (totalScore >= 25.0) return CharacterTier.SILVER;
        return CharacterTier.BRONZE;
    }

    private int resolveStage(int level) {
        if (level >= 15) return 3;
        if (level >= 10) return 2;
        if (level >= 5) return 1;
        return 0;
    }

    private String resolveTitle(int stage) {
        return switch (stage) {
            case 1 -> "\uB8E8\uD2F4 \uC785\uBB38\uC790";
            case 2 -> "\uC911\uAE09 \uD2B8\uB808\uC774\uB108";
            case 3 -> "\uC0C1\uAE09 \uD30C\uC6CC\uB7EC";
            default -> "\uCD08\uBCF4 \uD5EC\uB9B0\uC774";
        };
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double roundTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private CharacterProfile defaultProfile(User user) {
        return CharacterProfile.builder()
                .user(user)
                .level(1)
                .tier(CharacterTier.BRONZE)
                .evolutionStage(0)
                .title("\uCD08\uBCF4 \uD5EC\uB9B0\uC774")
                .isPublic(false)
                .build();
    }

    private User getUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    }
}


