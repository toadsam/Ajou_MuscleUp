package com.ajou.muscleup.dto.support;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class SupportChatRequest {
    @NotBlank
    @Size(max = 500)
    private String message;

    @Size(max = 200)
    private String page;
}
