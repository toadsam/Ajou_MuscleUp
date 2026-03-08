package com.ajou.muscleup.exception;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ApiErrorResponse {
    private int status;
    private String code;
    private String message;
    private LocalDateTime timestamp;
    private String path;
}
