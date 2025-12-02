package com.ajou.muscleup.dto.brag;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class BragCommentUpdateRequest {
    @NotBlank
    private String content;
}
