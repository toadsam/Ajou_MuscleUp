// com.ajou.muscleup.config.CorsConfig.java
package com.ajou.muscleup.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

  @Bean
  public CorsConfigurationSource corsConfigurationSource(
      @Value("${cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins) {
    CorsConfiguration cfg = new CorsConfiguration();
    // 쿠키(credentials)를 함께 보내므로 패턴/와일드카드가 아닌 정확한 출처만 허용한다.
    List<String> exactOrigins = allowedOrigins.stream()
        .map(String::trim)
        .filter(o -> !o.isEmpty())
        .map(o -> o.endsWith("/") ? o.substring(0, o.length() - 1) : o)
        .toList();
    for (String origin : exactOrigins) {
      if (origin.contains("*")) {
        throw new IllegalStateException("cors.allowed-origins must list exact origins; wildcard is not allowed: " + origin);
      }
    }
    cfg.setAllowedOrigins(exactOrigins);
    cfg.setAllowedHeaders(List.of(
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "x-auth-retry",
        "Cache-Control",
        "Pragma"
    ));
    cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cfg.setAllowCredentials(true);
    cfg.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cfg);
    return source;
  }
}
