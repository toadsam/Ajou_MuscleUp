package com.ajou.muscleup.dto.brag;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class BragCommentCreateRequest {
    @NotBlank
    private String content;
}
