package com.ajou.muscleup.dto.character;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GrowthParamsResponse {
    private double bmiNormalized;
    private double muscularityNormalized;
    private double fatNormalized;

    private double armGrowth;
    private double legGrowth;
    private double torsoGrowth;

    private double armScale;
    private double legScale;
    private double torsoScaleX;

    private double chestGrowth;
    private double backGrowth;
    private double shoulderGrowth;
    private double quadGrowth;
    private double hamstringGrowth;
    private double gluteGrowth;

    private double strokeWidth;
    private double muscleDetailOpacity;
    private double fatShadowOpacity;
    private double contrastBoost;
}
