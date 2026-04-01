package com.ajou.muscleup.service;

import com.ajou.muscleup.config.JwtUtil;
import com.ajou.muscleup.entity.RefreshToken;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.RefreshTokenRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Transactional
    public String issueFor(User user) {
        String token = jwtUtil.generateRefreshToken(user.getEmail());
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(jwtUtil.getRefreshTokenExpirationMs() / 1000L);

        RefreshToken rt = RefreshToken.builder()
                .user(user)
                .token(token)
                .expiresAt(expiresAt)
                .build();
        refreshTokenRepository.save(rt);
        return token;
    }

    @Transactional
    public String rotate(String oldToken) {
        RefreshToken current = refreshTokenRepository.findByToken(oldToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 리프레시 토큰"));

        if (!jwtUtil.validateToken(oldToken)
                || (jwtUtil.getTokenType(oldToken) != null && !"refresh".equals(jwtUtil.getTokenType(oldToken)))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "리프레시 토큰 검증 실패");
        }

        // Keep refresh token stable to prevent race-condition logouts when
        // parallel requests trigger refresh at the same time.
        return current.getToken();
    }

    @Transactional
    public void revokeAllByUserEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자 없음"));
        refreshTokenRepository.deleteByUser_Id(user.getId());
    }
}
