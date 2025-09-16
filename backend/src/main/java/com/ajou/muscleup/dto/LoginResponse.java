package com.ajou.muscleup.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {
    private String token;   // JWT 토큰
    private String email;   // 유저 이메일
    private String nickname; // 닉네임
    private String role;     // 권한 (USER/ADMIN 등)
}
