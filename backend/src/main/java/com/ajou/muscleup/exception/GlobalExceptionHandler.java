package com.ajou.muscleup.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleRSE(ResponseStatusException e, HttpServletRequest request) {
        return ResponseEntity.status(e.getStatusCode())
                .body(ApiErrorResponse.builder()
                        .status(e.getStatusCode().value())
                        .code(e.getStatusCode().toString())
                        .message(e.getReason())
                        .timestamp(LocalDateTime.now())
                        .path(request.getRequestURI())
                        .build());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
            MethodArgumentNotValidException e,
            HttpServletRequest request
    ) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst().map(fe -> fe.getField() + " " + fe.getDefaultMessage())
                .orElse("Validation error");
        return ResponseEntity.badRequest().body(ApiErrorResponse.builder()
                .status(400)
                .code("BAD_REQUEST")
                .message(msg)
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .build());
    }
}
