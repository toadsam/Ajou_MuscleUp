package com.ajou.muscleup.dto.review;

import jakarta.validation.constraints.*; import lombok.Getter;

@Getter
public class ReviewCreateRequest {
    @NotNull
    private Long proteinId;

    @Min(1)
    @Max(5)
    private int rating;

    @Size(max = 1000) // DB 컬럼 길이(Review.content length=1000)
    private String content;
}
