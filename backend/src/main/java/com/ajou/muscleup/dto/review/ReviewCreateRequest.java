package com.ajou.muscleup.dto.review;

import jakarta.validation.constraints.*; import lombok.Getter;

@Getter
public class ReviewCreateRequest {
    @NotNull private Long userId;
    @NotNull private Long proteinId;
    @Min(1) @Max(5) private int rating;
    private String content;
}
