package com.ajou.muscleup.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class UserRegisterRequest {
    @NotBlank
    private String name;

    @NotBlank @Email
    private String email;

    @NotBlank @Size(min = 8)
    private String password;

    // 닉네임은 프론트에서 안 보낼 수도 있으니 선택값으로 두고,
    // 서비스에서 비어있으면 name을 기본값으로 사용
    @Size(max = 30)
    private String nickname;
}
