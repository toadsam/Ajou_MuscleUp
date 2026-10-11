package com.ajou.muscleup.config;

import com.ajou.muscleup.service.AuditLogService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.Set;

@Component
public class AuditLogFilter extends OncePerRequestFilter {

    private static final Set<String> METHODS_TO_LOG = Set.of("POST", "PUT", "PATCH", "DELETE");
    private final AuditLogService auditLogService;

    public AuditLogFilter(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        boolean shouldLog = METHODS_TO_LOG.contains(request.getMethod());
        try {
            filterChain.doFilter(request, response);
        } finally {
            if (shouldLog) {
                String email = null;
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
                    email = auth.getName();
                }
                String resource = truncate(request.getRequestURI(), 255);
                String summary = truncate(request.getMethod() + " " + resource + " -> " + response.getStatus(), 1000);
                // server.forward-headers-strategy=framework 이면 getRemoteAddr() 가 프록시 뒤의 실제 접속 IP 다.
                String metadata = "ip=" + request.getRemoteAddr() + "; ua=" + truncate(request.getHeader("User-Agent"), 300);
                try {
                    // 비동기(@Async)로 저장한다. 요청 응답 시간에 DB 쓰기가 끼지 않는다.
                    auditLogService.log(email, request.getMethod(), resource, summary, metadata);
                } catch (RuntimeException e) {
                    logger.warn("Audit log enqueue failed: " + e.getClass().getSimpleName());
                }
            }
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
