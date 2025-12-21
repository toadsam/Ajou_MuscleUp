package com.ajou.muscleup.dto.program;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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
}
