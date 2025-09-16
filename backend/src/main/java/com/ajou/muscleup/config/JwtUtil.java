package com.ajou.muscleup.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    // 🔑 비밀 키 (실무에서는 환경변수에 보관해야 함)
    private static final String SECRET_KEY = "mysecretkeymysecretkeymysecretkey"; // 32바이트 이상
    private static final long EXPIRATION_TIME = 1000 * 60 * 60; // 1시간 유효

    private final Key key = Keys.hmacShaKeyFor(SECRET_KEY.getBytes());

    // ✅ 토큰 생성 (이메일 + 권한(role) 포함)
    public String generateToken(String email, String role) {
        return Jwts.builder()
                .setSubject(email) // 토큰 주제: 이메일
                .claim("role", role) // ✅ role claim 추가
                .setIssuedAt(new Date()) // 발급 시각
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME)) // 만료 시간
                .signWith(key, SignatureAlgorithm.HS256) // HS256 알고리즘으로 서명
                .compact();
    }

    // ✅ 토큰에서 이메일 꺼내기
    public String getEmailFromToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    // ✅ 토큰에서 역할(role) 꺼내기
    public String getRoleFromToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .get("role", String.class);
    }

    // ✅ 토큰 검증
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
