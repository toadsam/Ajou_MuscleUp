package com.ajou.muscleup.dto.protein;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class ProteinCreateUpdateRequest {
    @NotBlank private String name;
    private Integer price;
    private Integer days;
    private Integer goal;
    private String imageUrl;
    private String description;
    private String category;
}
