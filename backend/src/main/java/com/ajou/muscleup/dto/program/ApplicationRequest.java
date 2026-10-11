package com.ajou.muscleup.dto.program;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class ApplicationRequest {
    @NotBlank
    private String name;
    @Email
    @NotBlank
    private String email;
    @NotBlank
    private String goal;
    @NotBlank
    private String track;
    @NotBlank
    private String commitment;
    // 어느 짐(모임) 프로그램인지. 비우면 앱 전체
    @Size(max = 40)
    private String gymSlug;
}
