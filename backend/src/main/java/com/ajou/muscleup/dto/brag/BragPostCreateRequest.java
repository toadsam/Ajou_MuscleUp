package com.ajou.muscleup.dto.brag;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.util.List;

@Getter
public class BragPostCreateRequest {
    @NotBlank
    private String title;

    @NotBlank
    private String content;

    @Size(max = 10, message = "미디어는 최대 10개까지만 첨부 가능합니다.")
    private List<String> mediaUrls;

    private String movement;
    private String weight;
}
