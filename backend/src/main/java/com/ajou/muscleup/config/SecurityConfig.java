package com.ajou.muscleup.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.beans.factory.annotation.Qualifier;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AuditLogFilter auditLogFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          AuditLogFilter auditLogFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.auditLogFilter = auditLogFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public AuthenticationEntryPoint restAuthenticationEntryPoint() {
        return (request, response, authException) -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Bean
    public AccessDeniedHandler restAccessDeniedHandler() {
        return (request, response, accessDeniedException) -> response.sendError(HttpServletResponse.SC_FORBIDDEN);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   @Qualifier("corsConfigurationSource") CorsConfigurationSource corsConfigurationSource,
                                                   AuthenticationEntryPoint restAuthenticationEntryPoint,
                                                   AccessDeniedHandler restAccessDeniedHandler) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(restAuthenticationEntryPoint)
                .accessDeniedHandler(restAccessDeniedHandler)
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/error", "/favicon.ico").permitAll()
                .requestMatchers("/ping", "/api/ping").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/auth/google").permitAll()
                .requestMatchers("/api/support/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/users/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/programs/apply").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/analytics/events").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/ai/share/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/attendance/share/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/attendance/share/*/cheer").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/attendance/share/*/report").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/files/proxy").permitAll()
                .requestMatchers(HttpMethod.GET, "/share/attendance/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/metrics/lobby").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/push/config").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/events", "/api/events/*").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/events/*/view", "/api/events/*/click").permitAll()
                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                // 짐 찾기 · 짐 정보 · 운영진 소개는 로그인 없이(초대 링크 미리보기). /mine 은 서비스에서 로그인 확인
                .requestMatchers(HttpMethod.GET, "/api/gyms", "/api/gyms/*", "/api/gyms/*/members").permitAll()

                // Protected APIs (allow USER and ADMIN)
                .requestMatchers("/api/brags/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/proteins/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/proteins/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/proteins/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/proteins/**").hasRole("ADMIN")
                .requestMatchers("/api/proteins/*/applications/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/proteins/*/chat/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/ai/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/files/upload").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/files/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/files/**").hasRole("ADMIN")
                .requestMatchers("/api/mypage/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/character/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/rankings/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/attendance/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/events/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/lounge/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/crew/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/gyms/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/friends/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/diet/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/quests/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/lifts/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/workouts/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/runs/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/collection/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/gym-decor/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/push/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/club/roster").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/admin/events/**").hasRole("ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                .anyRequest().authenticated()
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .logout(logout -> logout.disable());

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterAfter(auditLogFilter, JwtAuthenticationFilter.class);
        return http.build();
    }
}
