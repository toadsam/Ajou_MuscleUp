package com.ajou.muscleup.dto.support;

import jakarta.validation.constraints.*;
import lombok.Getter;

@Getter
public class InquiryRequest {
    @Size(max = 100)
    private String name;
    @Email @Size(max = 150)
    private String email;
    @NotBlank @Size(max = 1000)
    private String message;
    @Size(max = 200)
    private String page;
    private Long userId; // optional
}

