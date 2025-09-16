// src/main/java/com/ajou/muscleup/config/SecurityConfig.java
package com.ajou.muscleup.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

// ⚡ JWT 필터 import
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    // 🔑 생성자 주입
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    // ✅ 비밀번호 암호화기 (회원가입/로그인 비번 암호화에 사용)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ✅ AuthenticationManager (로그인 시 인증 처리 담당)
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    // ✅ 보안 필터 체인 (URL 접근 권한 설정)
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // CSRF 비활성화 (JWT 사용할 거라 필요 없음)
            .cors(cors -> cors.configurationSource(corsConfigurationSource)) // CORS 설정 적용
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // 세션 대신 JWT 사용
            .authorizeHttpRequests(auth -> auth
                // [토큰 없어도 접근 가능한 API]
                .requestMatchers("/", "/error", "/favicon.ico").permitAll()
                .requestMatchers("/actuator/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()  // 로그인, 이메일 인증
                .requestMatchers(HttpMethod.POST, "/api/users/register").permitAll() // 회원가입 허용

                // [로그인한 사람만 접근 가능]
                .requestMatchers(HttpMethod.GET, "/api/proteins/**").hasRole("USER")   // 프로틴 조회
                .requestMatchers(HttpMethod.POST, "/api/proteins/**").hasRole("USER")  // 프로틴 등록

                // [기본 정책: 나머지는 인증 필요]
                .anyRequest().authenticated()
            )
            .httpBasic(basic -> basic.disable()) // HTTP Basic 인증 비활성화
            .formLogin(form -> form.disable())   // 폼 로그인 비활성화
            .logout(logout -> logout.disable()); // 로그아웃 엔드포인트 비활성화 (JWT 사용)

        // ⚡ JWT 필터를 UsernamePasswordAuthenticationFilter 전에 실행하도록 등록
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
