package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.GrowthParamsResponse;
import com.ajou.muscleup.entity.UserBodyStats;
import org.springframework.stereotype.Component;

@Component
public class CharacterGrowthCalculator {
    public GrowthParamsResponse calculate(UserBodyStats stats) {
        if (stats == null || stats.getHeightCm() == null || stats.getWeightKg() == null || stats.getWeightKg() <= 0) {
            return zero();
        }

        double heightM = stats.getHeightCm() / 100.0;
        if (heightM <= 0) {
            return zero();
        }

        double weight = stats.getWeightKg();
        double bmi = weight / (heightM * heightM);
        double muscularity = stats.getSkeletalMuscleKg() == null ? 0.0 : stats.getSkeletalMuscleKg() / weight;
        double fatness = stats.getBodyFatPercent() == null ? 0.0 : stats.getBodyFatPercent();
        double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
        double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
        double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();

        double bmiNormalized = normalize(bmi, 18.0, 32.0);
        double muscularityNormalized = normalize(muscularity, 0.25, 0.55);
        double fatNormalized = normalize(fatness, 8.0, 35.0);
        double benchNormalized = normalize(bench / weight, 0.0, 2.2);
        double squatNormalized = normalize(squat / weight, 0.0, 3.0);
        double deadliftNormalized = normalize(deadlift / weight, 0.0, 3.5);

        double lowerBodyRatio = resolveLowerBodyRatio(stats);
        double armGrowth = muscularityNormalized;
        double legGrowth = lowerBodyRatio >= 0 ? lowerBodyRatio : muscularityNormalized * 0.8;
        double torsoGrowth = fatNormalized * 0.5 + muscularityNormalized * 0.5;
        // Increase visual sensitivity so tiny stat deltas are still visible.
        armGrowth = clamp(Math.pow(armGrowth, 0.82), 0.0, 1.0);
        legGrowth = clamp(Math.pow(legGrowth, 0.86), 0.0, 1.0);
        torsoGrowth = clamp(Math.pow(torsoGrowth, 0.88), 0.0, 1.0);

        double chestGrowth = clamp(benchNormalized * 0.55 + muscularityNormalized * 0.25 + armGrowth * 0.2, 0.0, 1.0);
        double backGrowth = clamp(deadliftNormalized * 0.65 + muscularityNormalized * 0.2 + torsoGrowth * 0.15, 0.0, 1.0);
        double shoulderGrowth = clamp(benchNormalized * 0.5 + deadliftNormalized * 0.35 + muscularityNormalized * 0.15, 0.0, 1.0);
        double quadGrowth = clamp(squatNormalized * 0.7 + muscularityNormalized * 0.3, 0.0, 1.0);
        double hamstringGrowth = clamp(squatNormalized * 0.45 + deadliftNormalized * 0.55, 0.0, 1.0);
        double gluteGrowth = clamp(squatNormalized * 0.35 + deadliftNormalized * 0.65, 0.0, 1.0);

        double armScale = 1.0 + armGrowth * 0.2 + benchNormalized * 0.12 + shoulderGrowth * 0.08;
        double legScale = 1.0 + legGrowth * 0.16 + quadGrowth * 0.1 + hamstringGrowth * 0.08 + gluteGrowth * 0.08;
        double torsoScaleX = 1.0 + fatNormalized * 0.2 + chestGrowth * 0.08 + backGrowth * 0.1;

        double strokeWidth = 2.0 + muscularityNormalized * 1.2;
        double muscleDetailOpacity = Math.pow(muscularityNormalized, 1.3);
        double fatShadowOpacity = Math.pow(fatNormalized, 1.2);
        double contrastBoost = 1.0 + muscularityNormalized * 0.1;

        return GrowthParamsResponse.builder()
                .bmiNormalized(roundFour(bmiNormalized))
                .muscularityNormalized(roundFour(muscularityNormalized))
                .fatNormalized(roundFour(fatNormalized))
                .armGrowth(roundFour(armGrowth))
                .legGrowth(roundFour(legGrowth))
                .torsoGrowth(roundFour(torsoGrowth))
                .armScale(roundFour(armScale))
                .legScale(roundFour(legScale))
                .torsoScaleX(roundFour(torsoScaleX))
                .chestGrowth(roundFour(chestGrowth))
                .backGrowth(roundFour(backGrowth))
                .shoulderGrowth(roundFour(shoulderGrowth))
                .quadGrowth(roundFour(quadGrowth))
                .hamstringGrowth(roundFour(hamstringGrowth))
                .gluteGrowth(roundFour(gluteGrowth))
                .strokeWidth(roundFour(strokeWidth))
                .muscleDetailOpacity(roundFour(muscleDetailOpacity))
                .fatShadowOpacity(roundFour(fatShadowOpacity))
                .contrastBoost(roundFour(contrastBoost))
                .build();
    }

    private double resolveLowerBodyRatio(UserBodyStats stats) {
        double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
        double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
        double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
        double total = squat + deadlift + bench;
        if (total <= 0) {
            return -1.0;
        }
        return clamp((squat + deadlift) / total, 0.0, 1.0);
    }

    private GrowthParamsResponse zero() {
        return GrowthParamsResponse.builder()
                .bmiNormalized(0.0)
                .muscularityNormalized(0.0)
                .fatNormalized(0.0)
                .armGrowth(0.0)
                .legGrowth(0.0)
                .torsoGrowth(0.0)
                .armScale(1.0)
                .legScale(1.0)
                .torsoScaleX(1.0)
                .chestGrowth(0.0)
                .backGrowth(0.0)
                .shoulderGrowth(0.0)
                .quadGrowth(0.0)
                .hamstringGrowth(0.0)
                .gluteGrowth(0.0)
                .strokeWidth(2.0)
                .muscleDetailOpacity(0.0)
                .fatShadowOpacity(0.0)
                .contrastBoost(1.0)
                .build();
    }

    private double normalize(double value, double min, double max) {
        if (max <= min) {
            return 0.0;
        }
        return clamp((value - min) / (max - min), 0.0, 1.0);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double roundFour(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
