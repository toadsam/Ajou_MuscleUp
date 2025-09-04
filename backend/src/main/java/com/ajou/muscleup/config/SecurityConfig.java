// src/main/java/com/ajou/muscleup/config/SecurityConfig.java
package com.ajou.muscleup.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.CorsConfigurationSource; // ★ 주입받아 사용

@Configuration
public class SecurityConfig {

  @Bean
  public UserDetailsService userDetailsService() {
    return new InMemoryUserDetailsManager();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  // ★ 여기에 @Bean corsConfigurationSource()는 더 이상 만들지 않습니다.
  //   이미 CorsConfig 클래스에 동일한 빈이 있으므로 그걸 주입받아 사용합니다.
  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                 CorsConfigurationSource corsConfigurationSource) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .cors(cors -> cors.configurationSource(corsConfigurationSource)) // ★ 주입 사용
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/", "/error", "/favicon.ico").permitAll()
        .requestMatchers("/actuator/**", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
        .requestMatchers("/api/auth/email/**").permitAll()
        .requestMatchers(HttpMethod.POST, "/api/users/register").permitAll()
        .anyRequest().permitAll()
      )
      .httpBasic(basic -> basic.disable())
      .formLogin(form -> form.disable())
      .logout(logout -> logout.disable());

    return http.build();
  }
}
