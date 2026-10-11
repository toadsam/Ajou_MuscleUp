package com.ajou.muscleup.dto.protein;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class ProteinCreateUpdateRequest {
    @NotBlank private String name;
    @Min(0) private Integer price;
    @Min(1) @Max(365) private Integer days;
    @Min(1) private Integer goal;
    private String imageUrl;
    private String description;
    private String category;
    private String receiptUrl;
    @Size(max = 20) private String distributionMethod;
    // 모집 범위: 어느 짐에서(gymSlug) · 우리 모임만(GYM) / 전체 모집(PUBLIC). 둘 다 없으면 기본 짐의 GYM
    @Size(max = 40) private String gymSlug;
    private com.ajou.muscleup.entity.GroupBuyVisibility visibility;
    @Size(max = 40) private String region;
    @Min(2) @Max(500) private Integer maxParticipants;
}
