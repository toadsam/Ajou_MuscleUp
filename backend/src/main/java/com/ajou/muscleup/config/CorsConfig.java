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
    allowedOrigins.forEach(cfg::addAllowedOriginPattern);
    cfg.setAllowedHeaders(List.of(
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "x-auth-retry",
        "Cache-Control",
        "Pragma"
    ));
    cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cfg.setExposedHeaders(List.of("Set-Cookie"));
    cfg.setAllowCredentials(true);
    cfg.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cfg);
    return source;
  }
}
