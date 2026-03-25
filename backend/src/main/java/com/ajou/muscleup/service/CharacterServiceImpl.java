package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.character.CharacterEvaluationResponse;
import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.dto.character.CharacterPublicUpdateRequest;
import com.ajou.muscleup.dto.character.CharacterRestUpdateRequest;
import com.ajou.muscleup.dto.character.CharacterSnapshotResponse;
import com.ajou.muscleup.dto.character.GrowthParamsResponse;
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
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CharacterServiceImpl implements CharacterService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final List<String> STYLE_PRESETS = List.of("POWER", "AGILE", "BALANCED", "CALM");

    private final UserRepository userRepository;
    private final UserBodyStatsRepository statsRepository;
    private final CharacterProfileRepository profileRepository;
    private final CharacterEvolutionHistoryRepository historyRepository;
    private final CharacterGrowthCalculator growthCalculator;

    @Override
    @Transactional
    public CharacterProfileResponse getOrCreateProfile(String email) {
        User user = getUserOrThrow(email);
        UserBodyStats stats = statsRepository.findByUser(user).orElse(null);
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user, stats)));
        ensureIdentity(profile, stats);
        return toProfileResponse(profile, stats);
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
        UserBodyStats stats = statsRepository.findByUser(user).orElse(null);
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user, stats)));
        ensureIdentity(profile, stats);
        profile.setPublic(Boolean.TRUE.equals(request.getIsPublic()));
        CharacterProfile saved = profileRepository.save(profile);
        return toProfileResponse(saved, stats);
    }

    @Override
    @Transactional
    public CharacterProfileResponse updateResting(String email, CharacterRestUpdateRequest request) {
        User user = getUserOrThrow(email);
        UserBodyStats stats = statsRepository.findByUser(user).orElse(null);
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user, stats)));
        ensureIdentity(profile, stats);
        profile.setResting(Boolean.TRUE.equals(request.getIsResting()));
        CharacterProfile saved = profileRepository.save(profile);
        return toProfileResponse(saved, stats);
    }

    @Override
    @Transactional
    public CharacterProfileResponse reroll(String email) {
        User user = getUserOrThrow(email);
        UserBodyStats stats = statsRepository.findByUser(user).orElse(null);
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user, stats)));
        ensureIdentity(profile, stats);

        CharacterSnapshotResponse beforeSnapshot = CharacterSnapshotResponse.from(profile);

        profile.setAvatarSeed(generateAvatarSeed());
        profile.setStylePreset(pickStylePreset(stats == null ? null : stats.getMbti()));
        profile.setRerollCount(profile.getRerollCount() + 1);
        CharacterProfile saved = profileRepository.save(profile);

        CharacterSnapshotResponse afterSnapshot = CharacterSnapshotResponse.from(saved);
        historyRepository.save(CharacterEvolutionHistory.builder()
                .user(user)
                .triggerType(CharacterEvolutionTriggerType.REROLL)
                .beforeLevel(beforeSnapshot.getLevel())
                .afterLevel(afterSnapshot.getLevel())
                .beforeTier(beforeSnapshot.getTier())
                .afterTier(afterSnapshot.getTier())
                .beforeStage(beforeSnapshot.getEvolutionStage())
                .afterStage(afterSnapshot.getEvolutionStage())
                .build());

        return toProfileResponse(saved, stats);
    }

    @Transactional
    public StatsCharacterResponse evaluateAndUpdate(User user, UserBodyStats stats, CharacterEvolutionTriggerType triggerType) {
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(defaultProfile(user, stats)));
        ensureIdentity(profile, stats);
        CharacterSnapshotResponse beforeSnapshot = CharacterSnapshotResponse.from(profile);

        double attendanceBonus = calculateAttendanceBonus(profile.getAttendancePoints());
        CharacterEvaluationResponse evaluation = evaluateStats(stats, attendanceBonus);
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
                .character(toProfileResponse(saved, stats))
                .evaluation(evaluation)
                .change(change)
                .build();
    }

    private CharacterProfileResponse toProfileResponse(CharacterProfile profile, UserBodyStats stats) {
        GrowthParamsResponse growthParams = growthCalculator.calculate(stats);
        return CharacterProfileResponse.from(profile, growthParams);
    }

    private void ensureIdentity(CharacterProfile profile, UserBodyStats stats) {
        boolean dirty = false;
        if (profile.getAvatarSeed() == null || profile.getAvatarSeed().isBlank()) {
            profile.setAvatarSeed(generateAvatarSeed());
            dirty = true;
        }
        if (profile.getStylePreset() == null || profile.getStylePreset().isBlank()) {
            profile.setStylePreset(pickStylePreset(stats == null ? null : stats.getMbti()));
            dirty = true;
        }
        Gender nextGender = stats == null ? profile.getGender() : stats.getGender();
        if (profile.getGender() != nextGender) {
            profile.setGender(nextGender);
            dirty = true;
        }
        if (dirty) {
            profileRepository.save(profile);
        }
    }

    private CharacterEvaluationResponse evaluateStats(UserBodyStats stats, double attendanceBonus) {
        double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
        double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
        double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
        double weight = stats.getWeightKg() == null ? 0.0 : stats.getWeightKg();
        double heightM = resolveHeightMeters(stats.getHeightCm());
        if (weight < 20 || weight > 300) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weightKg must be between 20 and 300");
        }
        Gender gender = stats.getGender() != null ? stats.getGender() : Gender.MALE;

        double threeLiftTotal = bench + squat + deadlift;
        double strengthRatio = weight > 0 ? threeLiftTotal / weight : 0.0;
        double bmi = weight / (heightM * heightM);
        double bodyFatPercent = stats.getBodyFatPercent() == null
                ? (gender == Gender.FEMALE ? 27.0 : 18.0)
                : stats.getBodyFatPercent();

        // Priority order:
        // 1) Absolute 3-lift score (largest impact)
        // 2) Relative strength score (3-lift / bodyweight)
        // 3) Height-adjusted muscle quality (SMI)
        // 4) Body composition fit (BMI + body-fat)
        double threeLiftAbsoluteScore = scoreThreeLiftAbsolute(gender, threeLiftTotal); // 0..55
        double strengthRatioScore = scoreStrengthRatio(gender, strengthRatio); // 0..20

        double smi = 0.0;
        double heightMuscleScore = 0.0; // 0..15
        if (stats.getSkeletalMuscleKg() != null) {
            smi = stats.getSkeletalMuscleKg() / (heightM * heightM);
            heightMuscleScore = scoreHeightAdjustedMuscle(gender, smi);
        }

        double bmiFitScore = scoreBmiFit(gender, bmi); // 0..6
        double fatFitScore = scoreBodyFatFit(gender, bodyFatPercent); // 0..4
        double heightWeightScore = bmiFitScore + fatFitScore; // 0..10

        double totalScore = clamp(
                threeLiftAbsoluteScore + strengthRatioScore + heightMuscleScore + heightWeightScore + attendanceBonus,
                0.0,
                100.0
        );
        int level = Math.min(100, 1 + (int) Math.floor(totalScore));
        CharacterTier tier = resolveTier(totalScore, threeLiftTotal, gender);
        int stage = resolveStage(level);
        String title = resolveTitle(stage);

        return CharacterEvaluationResponse.builder()
                .threeLiftTotal(roundOneDecimal(threeLiftTotal))
                .strengthRatio(roundTwoDecimals(strengthRatio))
                .bmi(roundTwoDecimals(bmi))
                .skeletalMuscleIndex(roundTwoDecimals(smi))
                .heightWeightScore(roundTwoDecimals(heightWeightScore))
                .heightMuscleScore(roundTwoDecimals(heightMuscleScore))
                .totalScore(roundTwoDecimals(totalScore))
                .level(level)
                .tier(tier)
                .evolutionStage(stage)
                .title(title)
                .build();
    }

    private CharacterTier resolveTier(double totalScore, double threeLiftTotal, Gender gender) {
        CharacterTier scoreTier = resolveTierByScore(totalScore);
        if (threeLiftTotal > 0) {
            CharacterTier liftTier;
            if (gender == Gender.FEMALE) {
                if (threeLiftTotal >= 420) liftTier = CharacterTier.CHALLENGER;
                else if (threeLiftTotal >= 360) liftTier = CharacterTier.GRANDMASTER;
                else if (threeLiftTotal >= 300) liftTier = CharacterTier.MASTER;
                else if (threeLiftTotal >= 240) liftTier = CharacterTier.DIAMOND;
                else if (threeLiftTotal >= 180) liftTier = CharacterTier.PLATINUM;
                else if (threeLiftTotal >= 120) liftTier = CharacterTier.GOLD;
                else if (threeLiftTotal >= 70) liftTier = CharacterTier.SILVER;
                else liftTier = CharacterTier.BRONZE;
            } else {
                if (threeLiftTotal >= 700) liftTier = CharacterTier.CHALLENGER;
                else if (threeLiftTotal >= 600) liftTier = CharacterTier.GRANDMASTER;
                else if (threeLiftTotal >= 500) liftTier = CharacterTier.MASTER;
                else if (threeLiftTotal >= 420) liftTier = CharacterTier.DIAMOND;
                else if (threeLiftTotal >= 320) liftTier = CharacterTier.PLATINUM;
                else if (threeLiftTotal >= 220) liftTier = CharacterTier.GOLD;
                else if (threeLiftTotal >= 120) liftTier = CharacterTier.SILVER;
                else liftTier = CharacterTier.BRONZE;
            }
            return blendLiftAndScoreTier(liftTier, scoreTier);
        }
        return scoreTier;
    }

    private CharacterTier resolveTierByScore(double totalScore) {
        if (totalScore >= 98.0) return CharacterTier.CHALLENGER;
        if (totalScore >= 94.0) return CharacterTier.GRANDMASTER;
        if (totalScore >= 88.0) return CharacterTier.MASTER;
        if (totalScore >= 80.0) return CharacterTier.DIAMOND;
        if (totalScore >= 65.0) return CharacterTier.PLATINUM;
        if (totalScore >= 45.0) return CharacterTier.GOLD;
        if (totalScore >= 25.0) return CharacterTier.SILVER;
        return CharacterTier.BRONZE;
    }

    private CharacterTier blendLiftAndScoreTier(CharacterTier liftTier, CharacterTier scoreTier) {
        int liftIndex = tierIndex(liftTier);
        int scoreIndex = tierIndex(scoreTier);
        if (scoreIndex >= liftIndex + 2) {
            return tierByIndex(Math.min(7, liftIndex + 1));
        }
        if (scoreIndex <= liftIndex - 2) {
            return tierByIndex(Math.max(0, liftIndex - 1));
        }
        return liftTier;
    }

    private int tierIndex(CharacterTier tier) {
        return switch (tier) {
            case BRONZE -> 0;
            case SILVER -> 1;
            case GOLD -> 2;
            case PLATINUM -> 3;
            case DIAMOND -> 4;
            case MASTER -> 5;
            case GRANDMASTER -> 6;
            case CHALLENGER -> 7;
        };
    }

    private CharacterTier tierByIndex(int index) {
        return switch (index) {
            case 1 -> CharacterTier.SILVER;
            case 2 -> CharacterTier.GOLD;
            case 3 -> CharacterTier.PLATINUM;
            case 4 -> CharacterTier.DIAMOND;
            case 5 -> CharacterTier.MASTER;
            case 6 -> CharacterTier.GRANDMASTER;
            case 7 -> CharacterTier.CHALLENGER;
            default -> CharacterTier.BRONZE;
        };
    }

    private double resolveHeightMeters(Integer heightCm) {
        if (heightCm == null || heightCm < 120 || heightCm > 230) {
            return 1.70;
        }
        return heightCm / 100.0;
    }

    private double scoreThreeLiftAbsolute(Gender gender, double threeLiftTotal) {
        // Match existing tier boundaries and map to 0..55 points.
        double top = gender == Gender.FEMALE ? 420.0 : 700.0;
        double normalized = clamp(threeLiftTotal / top, 0.0, 1.0);
        return normalized * 55.0;
    }

    private double scoreStrengthRatio(Gender gender, double ratio) {
        double cap = gender == Gender.FEMALE ? 3.0 : 3.5;
        double normalized = clamp(ratio / cap, 0.0, 1.0);
        return normalized * 20.0;
    }

    private double scoreBmiFit(Gender gender, double bmi) {
        double target = gender == Gender.FEMALE ? 21.0 : 23.0;
        double distance = Math.abs(bmi - target);
        // Max 6 points. Kept lower than 3-lift metrics.
        return clamp(6.0 - distance * 0.9, 0.0, 6.0);
    }

    private double scoreBodyFatFit(Gender gender, double bodyFatPercent) {
        double target = gender == Gender.FEMALE ? 24.0 : 15.0;
        double distance = Math.abs(bodyFatPercent - target);
        // Max 4 points. Supportive factor only.
        return clamp(4.0 - distance * 0.22, 0.0, 4.0);
    }

    private double scoreHeightAdjustedMuscle(Gender gender, double smi) {
        double target = gender == Gender.FEMALE ? 8.7 : 10.8;
        double distance = Math.abs(smi - target);
        // Max 15 points. Height-adjusted muscle quality.
        return clamp(15.0 - distance * 2.1, 0.0, 15.0);
    }

    private int resolveStage(int level) {
        int normalized = Math.max(1, Math.min(level, 100));
        return Math.min(9, (normalized - 1) / 10);
    }

    private String resolveTitle(int stage) {
        return switch (stage) {
            case 1 -> "루틴 입문자";
            case 2 -> "중급 트레이너";
            case 3 -> "상급 파워러";
            case 4 -> "파워 가속자";
            case 5 -> "피트니스 강자";
            case 6 -> "에지 마스터";
            case 7 -> "에포스 에시언트";
            case 8 -> "레전드 파워러";
            case 9 -> "어의너";
            default -> "초보 헬린이";
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

    private CharacterProfile defaultProfile(User user, UserBodyStats stats) {
        return defaultProfileStatic(user, stats == null ? null : stats.getMbti());
    }

    static CharacterProfile defaultProfileStatic(User user, String mbti) {
        return CharacterProfile.builder()
                .user(user)
                .level(1)
                .tier(CharacterTier.BRONZE)
                .evolutionStage(0)
                .title("초보 헬린이")
                .isPublic(false)
                .attendancePoints(0)
                .avatarSeed(generateAvatarSeed())
                .stylePreset(pickStylePreset(mbti))
                .gender(null)
                .isResting(false)
                .rerollCount(0)
                .build();
    }

    private double calculateAttendanceBonus(int attendancePoints) {
        // Attendance helps, but should not override physical metrics.
        return clamp(attendancePoints * 0.4, 0.0, 8.0);
    }

    private User getUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    private static String generateAvatarSeed() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        StringBuilder builder = new StringBuilder(32);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }

    private static String pickStylePreset(String mbti) {
        String normalizedMbti = mbti == null ? "" : mbti.trim().toUpperCase(Locale.ROOT);
        double roll = RANDOM.nextDouble();

        if (normalizedMbti.startsWith("E")) {
            if (roll < 0.45) return "POWER";
            if (roll < 0.75) return "AGILE";
            if (roll < 0.9) return "BALANCED";
            return "CALM";
        }
        if (normalizedMbti.startsWith("I")) {
            if (roll < 0.4) return "CALM";
            if (roll < 0.7) return "BALANCED";
            if (roll < 0.88) return "AGILE";
            return "POWER";
        }

        return STYLE_PRESETS.get((int) (roll * STYLE_PRESETS.size()));
    }
}
