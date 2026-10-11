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
}
