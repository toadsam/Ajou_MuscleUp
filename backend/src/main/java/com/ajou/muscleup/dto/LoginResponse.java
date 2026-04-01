package com.ajou.muscleup.dto;

import lombok.Getter;

@Getter
public class LoginResponse {
    private final String token;
    private final String email;
    private final String nickname;
    private final String role;
    private final String refreshToken;

    public LoginResponse(String token, String email, String nickname, String role) {
        this(token, email, nickname, role, null);
    }

    public LoginResponse(String token, String email, String nickname, String role, String refreshToken) {
        this.token = token;
        this.email = email;
        this.nickname = nickname;
        this.role = role;
        this.refreshToken = refreshToken;
    }
}
