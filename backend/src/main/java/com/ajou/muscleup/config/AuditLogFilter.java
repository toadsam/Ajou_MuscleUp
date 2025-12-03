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
                String resource = request.getRequestURI();
                String summary = request.getMethod() + " " + resource + " -> " + response.getStatus();
                String metadata = "ip=" + request.getRemoteAddr() + "; ua=" + request.getHeader("User-Agent");
                auditLogService.log(email, request.getMethod(), resource, summary, metadata);
            }
        }
    }
}
