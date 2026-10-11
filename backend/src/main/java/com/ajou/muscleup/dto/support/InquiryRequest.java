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
    /** 무시된다. 서버가 로그인 정보로 채운다(예전 클라이언트 호환용으로 필드만 남김). */
    private Long userId;
}

