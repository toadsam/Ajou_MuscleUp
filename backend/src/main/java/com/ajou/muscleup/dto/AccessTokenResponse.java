package com.ajou.muscleup.dto;

import lombok.Getter;

@Getter
public class AccessTokenResponse {
    private final String token;
    private final String accessToken;
    private final String refreshToken;

    public AccessTokenResponse(String accessToken) {
        this(accessToken, null);
    }

    public AccessTokenResponse(String accessToken, String refreshToken) {
        this.token = accessToken;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
}
