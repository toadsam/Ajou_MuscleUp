package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder(toBuilder = true)
public class CharacterProfileResponse {
    private int level;
    private CharacterTier tier;
    private int evolutionStage;
    private String title;
    private String avatarSeed;
    private String stylePreset;
    private Gender gender;
    private GrowthParamsResponse growthParams;
    @JsonProperty("isPublic")
    private boolean isPublic;
    @JsonProperty("isResting")
    private boolean isResting;
    private LocalDateTime lastEvaluatedAt;
    private LocalDateTime updatedAt;
    /** 운동 세션 직후 펌핑이 끝나는 시각(epoch ms). 펌핑 중이 아니면 null — AvatarLookService */
    private Long pumpedUntil;
    /** 도감에서 장착한 민소매 색(#RRGGBB) 또는 null */
    private String tank;

    // ── 경험치(EXP) ─────────────────────────────────────────────
    // 기존 성장 규칙을 그대로 풀어 보여 주는 값이다(경제 규칙은 바꾸지 않았다).
    //   totalScore(0..100) = 신체 점수(3대 절대 0..55 + 상대 근력 0..20 + 키 대비 근육 0..15 + BMI·체지방 0..10)
    //                        + attendanceBonus(= min(8, attendancePoints × 0.4))
    //   level = 1 + floor(totalScore)   (최대 100)
    //   exp   = floor((totalScore - floor(totalScore)) × 100)  → 이번 레벨 안에서 0..99
    //   expToNextLevel = 100 - exp,  levelProgress = exp 비율(0..1)
    // 체성분(UserBodyStats)을 입력하지 않았으면 레벨 계산 자체가 돌지 않아 출석 포인트가 레벨에 반영되지 않는다
    // → hasBodyStats=false, exp·levelProgress·expToNextLevel 은 null.

    /** 출석·이벤트로 쌓인 누적 포인트(원래 값). */
    private int attendancePoints;
    /** 출석 포인트가 레벨 점수에 더해 주는 몫(0..attendanceBonusMax). */
    private double attendanceBonus;
    private double attendanceBonusMax;
    /** 체성분 입력 여부. false 면 출석 포인트가 아직 레벨에 반영되지 않는다. */
    private boolean hasBodyStats;
    /** 이번 레벨 안에서의 경험치(0..99). 최대 레벨이거나 계산 불가면 null. */
    private Integer exp;
    /** 다음 레벨까지 남은 경험치(1..100). 최대 레벨이거나 계산 불가면 null. */
    private Integer expToNextLevel;
    /** 이번 레벨 진행률(0..1). */
    private Double levelProgress;
    /** 출석 포인트만으로 다음 레벨에 가려면 더 필요한 포인트. 출석 보너스가 상한(8)에 걸려 출석만으로는 못 가면 null. */
    private Integer attendancePointsToNextLevel;

    public static CharacterProfileResponse from(CharacterProfile profile, GrowthParamsResponse growthParams) {
        return from(profile, growthParams, null);
    }

    public static CharacterProfileResponse from(
            CharacterProfile profile,
            GrowthParamsResponse growthParams,
            ExpInfo expInfo
    ) {
        return CharacterProfileResponse.builder()
                .level(profile.getLevel())
                .tier(profile.getTier())
                .evolutionStage(profile.getEvolutionStage())
                .title(profile.getTitle())
                .avatarSeed(profile.getAvatarSeed())
                .stylePreset(profile.getStylePreset())
                .gender(profile.getGender())
                .growthParams(growthParams)
                .isPublic(profile.isPublic())
                .isResting(profile.isResting())
                .lastEvaluatedAt(profile.getLastEvaluatedAt())
                .updatedAt(profile.getUpdatedAt())
                .attendancePoints(profile.getAttendancePoints())
                .attendanceBonus(expInfo == null ? 0.0 : expInfo.attendanceBonus())
                .attendanceBonusMax(expInfo == null ? 0.0 : expInfo.attendanceBonusMax())
                .hasBodyStats(expInfo != null && expInfo.hasBodyStats())
                .exp(expInfo == null ? null : expInfo.exp())
                .expToNextLevel(expInfo == null ? null : expInfo.expToNextLevel())
                .levelProgress(expInfo == null ? null : expInfo.levelProgress())
                .attendancePointsToNextLevel(expInfo == null ? null : expInfo.attendancePointsToNextLevel())
                .build();
    }

    /** CharacterServiceImpl 이 기존 평가 로직으로 계산해 넘겨 주는 경험치 정보. */
    public record ExpInfo(
            double attendanceBonus,
            double attendanceBonusMax,
            boolean hasBodyStats,
            Integer exp,
            Integer expToNextLevel,
            Double levelProgress,
            Integer attendancePointsToNextLevel
    ) {}
}
