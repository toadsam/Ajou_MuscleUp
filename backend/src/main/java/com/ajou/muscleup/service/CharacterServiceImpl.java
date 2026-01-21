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
import com.ajou.muscleup.entity.Gender;
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
        Gender gender = stats.getGender() != null ? stats.getGender() : Gender.MALE;

        double threeLiftTotal = bench + squat + deadlift;
        double strengthRatio = weight > 0 ? threeLiftTotal / weight : 0.0;
        double strengthMultiplier = resolveStrengthMultiplier(gender, strengthRatio);
        double muscleMultiplier = gender == Gender.FEMALE ? 22.0 : 20.0;
        double base = clamp(strengthRatio * strengthMultiplier, 0.0, 70.0);

        double muscleBonus = 0.0;
        if (stats.getSkeletalMuscleKg() != null && weight > 0) {
            muscleBonus = clamp((stats.getSkeletalMuscleKg() / weight) * muscleMultiplier, 0.0, 30.0);
        }

        double totalScore = clamp(base + muscleBonus, 0.0, 100.0);
        int level = Math.min(100, 1 + (int) Math.floor(totalScore));
        CharacterTier tier = resolveTier(totalScore, threeLiftTotal, gender);
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

    private CharacterTier resolveTier(double totalScore, double threeLiftTotal, Gender gender) {
        if (threeLiftTotal > 0) {
            if (gender == Gender.FEMALE) {
                if (threeLiftTotal >= 420) return CharacterTier.CHALLENGER;
                if (threeLiftTotal >= 360) return CharacterTier.GRANDMASTER;
                if (threeLiftTotal >= 300) return CharacterTier.MASTER;
                if (threeLiftTotal >= 240) return CharacterTier.DIAMOND;
                if (threeLiftTotal >= 180) return CharacterTier.PLATINUM;
                if (threeLiftTotal >= 120) return CharacterTier.GOLD;
                if (threeLiftTotal >= 70) return CharacterTier.SILVER;
                return CharacterTier.BRONZE;
            }
            if (threeLiftTotal >= 700) return CharacterTier.CHALLENGER;
            if (threeLiftTotal >= 600) return CharacterTier.GRANDMASTER;
            if (threeLiftTotal >= 500) return CharacterTier.MASTER;
            if (threeLiftTotal >= 420) return CharacterTier.DIAMOND;
            if (threeLiftTotal >= 320) return CharacterTier.PLATINUM;
            if (threeLiftTotal >= 220) return CharacterTier.GOLD;
            if (threeLiftTotal >= 120) return CharacterTier.SILVER;
            return CharacterTier.BRONZE;
        }
        if (totalScore >= 98.0) return CharacterTier.CHALLENGER;
        if (totalScore >= 94.0) return CharacterTier.GRANDMASTER;
        if (totalScore >= 88.0) return CharacterTier.MASTER;
        if (totalScore >= 80.0) return CharacterTier.DIAMOND;
        if (totalScore >= 65.0) return CharacterTier.PLATINUM;
        if (totalScore >= 45.0) return CharacterTier.GOLD;
        if (totalScore >= 25.0) return CharacterTier.SILVER;
        return CharacterTier.BRONZE;
    }

    private double resolveStrengthMultiplier(Gender gender, double ratio) {
        if (gender == Gender.FEMALE) {
            if (ratio < 1.0) return 16.0;
            if (ratio < 1.5) return 20.0;
            if (ratio < 2.0) return 24.0;
            if (ratio < 2.5) return 28.0;
            if (ratio < 3.0) return 32.0;
            return 36.0;
        }
        if (ratio < 1.0) return 14.0;
        if (ratio < 1.5) return 18.0;
        if (ratio < 2.0) return 22.0;
        if (ratio < 2.5) return 26.0;
        if (ratio < 3.0) return 30.0;
        return 34.0;
    }

    private int resolveStage(int level) {
        int normalized = Math.max(1, Math.min(level, 100));
        return Math.min(9, (normalized - 1) / 10);
    }

    private String resolveTitle(int stage) {
        return switch (stage) {
            case 1 -> "\uB8E8\uD2F4 \uC785\uBB38\uC790";
            case 2 -> "\uC911\uAE09 \uD2B8\uB808\uC774\uB108";
            case 3 -> "\uC0C1\uAE09 \uD30C\uC6CC\uB7EC";
            case 4 -> "\uD30C\uC6CC \uAC00\uC18D\uC790";
            case 5 -> "\uD53C\uD2B8\uB2C8\uC2A4 \uAC15\uC790";
            case 6 -> "\uC5D0\uC9C0 \uB9C8\uC2A4\uD130";
            case 7 -> "\uC5D0\uD3EC\uC2A4 \uC5D0\uC2DC\uC5B8\uD2B8";
            case 8 -> "\uB808\uC804\uB4DC \uD30C\uC6CC\uB7EC";
            case 9 -> "\uC5B4\uC758\uB108";
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


