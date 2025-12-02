package com.ajou.muscleup.dto.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;

@Getter
public class ReviewUpdateRequest {
    @Min(1)
    @Max(5)
    private int rating;
    private String content;
}
