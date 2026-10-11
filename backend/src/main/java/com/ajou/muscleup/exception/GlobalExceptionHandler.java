package com.ajou.muscleup.exception;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.beans.TypeMismatchException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.server.ResponseStatusException;

/**
 * API 오류를 한 모양(ApiErrorResponse)으로 돌려준다.
 * - 화면에 그대로 보여도 되는 한국어 문장만 message 에 담는다.
 * - 예외 원문, 스택, SQL, 클래스 이름은 응답에 넣지 않고 서버 로그에만 남긴다.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleRSE(ResponseStatusException e, HttpServletRequest request) {
        String reason = e.getReason();
        if (reason == null || reason.isBlank()) {
            reason = messageFor(e.getStatusCode());
        }
        return build(e.getStatusCode(), e.getStatusCode().toString(), reason, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
            MethodArgumentNotValidException e,
            HttpServletRequest request
    ) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst().map(fe -> fe.getField() + " " + fe.getDefaultMessage())
                .orElse("입력값을 다시 확인해 주세요.");
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", msg, request);
    }

    @ExceptionHandler({BindException.class, HandlerMethodValidationException.class,
            HttpMessageNotReadableException.class, TypeMismatchException.class})
    public ResponseEntity<ApiErrorResponse> handleBadInput(Exception e, HttpServletRequest request) {
        log.debug("Bad request on {}: {}", request.getRequestURI(), e.getMessage());
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "입력값을 다시 확인해 주세요.", request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException e, HttpServletRequest request) {
        log.info("IllegalArgument on {}: {}", request.getRequestURI(), e.getMessage());
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "요청 내용을 처리할 수 없어요. 입력값을 확인해 주세요.", request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(DataIntegrityViolationException e, HttpServletRequest request) {
        log.warn("Data integrity violation on {}: {}", request.getRequestURI(), e.getMostSpecificCause().getMessage());
        return build(HttpStatus.CONFLICT, "CONFLICT", "이미 처리되었거나 중복된 요청이에요.", request);
    }

    @ExceptionHandler(JwtException.class)
    public ResponseEntity<ApiErrorResponse> handleJwt(JwtException e, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 만료되었어요. 다시 로그인해 주세요.", request);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuthentication(AuthenticationException e, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요해요.", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException e, HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN", "이 기능을 쓸 권한이 없어요.", request);
    }

    /** 404(없는 경로), 405, 413(업로드 크기), 415 같은 스프링 MVC 표준 예외. 상태 코드는 그대로 두고 문장만 바꾼다. */
    @ExceptionHandler({ServletException.class, ErrorResponseException.class})
    public ResponseEntity<ApiErrorResponse> handleSpringErrorResponse(Exception e, HttpServletRequest request) {
        HttpStatusCode status = (e instanceof ErrorResponse er) ? er.getStatusCode() : HttpStatus.INTERNAL_SERVER_ERROR;
        if (status.is5xxServerError()) {
            log.error("Server error on {}", request.getRequestURI(), e);
        }
        return build(status, status.toString(), messageFor(status), request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUpload(MaxUploadSizeExceededException e, HttpServletRequest request) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE", messageFor(HttpStatus.PAYLOAD_TOO_LARGE), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception e, HttpServletRequest request) {
        log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR",
                "일시적인 문제로 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.", request);
    }

    private ResponseEntity<ApiErrorResponse> build(HttpStatusCode status, String code, String message, HttpServletRequest request) {
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.builder()
                        .status(status.value())
                        .code(code)
                        .message(message)
                        .timestamp(LocalDateTime.now())
                        .path(request.getRequestURI())
                        .build());
    }

    private static String messageFor(HttpStatusCode status) {
        return switch (status.value()) {
            case 400 -> "입력값을 다시 확인해 주세요.";
            case 401 -> "로그인이 필요해요.";
            case 403 -> "이 기능을 쓸 권한이 없어요.";
            case 404 -> "요청한 내용을 찾을 수 없어요.";
            case 405 -> "지원하지 않는 요청 방식이에요.";
            case 409 -> "이미 처리되었거나 중복된 요청이에요.";
            case 413 -> "파일이 너무 커요. 더 작은 파일로 올려 주세요.";
            case 415 -> "지원하지 않는 형식이에요.";
            case 429 -> "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
            default -> status.is5xxServerError()
                    ? "일시적인 문제로 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."
                    : "요청을 처리하지 못했어요.";
        };
    }
}
