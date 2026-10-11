package com.ajou.muscleup.dto.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;

@Getter
public class ReviewUpdateRequest {
    @Min(1)
    @Max(5)
    private int rating;
    @jakarta.validation.constraints.Size(max = 1000) // DB 컬럼 길이
    private String content;
}
