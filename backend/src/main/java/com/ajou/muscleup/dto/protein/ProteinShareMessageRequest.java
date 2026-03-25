package com.ajou.muscleup.dto.protein;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class ProteinShareMessageRequest {
    @NotBlank
    private String content;
}
