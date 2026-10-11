package com.ajou.muscleup.service;

import com.ajou.muscleup.config.JwtUtil;
import com.ajou.muscleup.entity.RefreshToken;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.RefreshTokenRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 리프레시 토큰 발급 · 회전 · 폐기.
 *
 * - 토큰은 추측할 수 없는 무작위 문자열(256비트)이고, 쿠키(httpOnly)로만 오간다.
 * - DB 에는 SHA-256 해시만 저장한다.
 * - 갱신할 때마다 새 토큰을 주고 이전 토큰은 폐기한다(진짜 회전).
 * - 동시에 여러 탭이 갱신해도 로그아웃되지 않도록, 폐기 직후 GRACE_SECONDS 동안은 같은 이전 토큰으로
 *   다시 오면 방금 만든 새 토큰을 그대로 돌려준다.
 * - 유예 시간이 지난 뒤 폐기된 토큰이 다시 오면 탈취로 보고 그 사용자의 토큰을 모두 지운다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    /** 폐기 직후 같은 토큰으로 다시 와도 정상으로 보는 시간(동시 갱신 대비). */
    static final long GRACE_SECONDS = 30;
    /** 폐기된 행을 재사용 탐지용으로 남겨 두는 기간. */
    static final long REVOKED_RETENTION_DAYS = 7;

    private static final SecureRandom RND = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    /** 이전 토큰 해시 → (새 토큰 원문, 만든 시각). 유예 시간 안에서만 쓰는 메모리 캐시. */
    private final Map<String, GraceEntry> graceCache = new ConcurrentHashMap<>();

    private record GraceEntry(String rawToken, LocalDateTime createdAt) {}

    /** 회전 결과: 새 토큰 원문과 그 주인의 이메일·역할(트랜잭션 안에서 읽어 둔다). */
    public record Rotation(String token, String email, String role) {
        static Rotation of(String token, User user) {
            return new Rotation(token, user.getEmail(), user.getRole());
        }
    }

    @Transactional
    public String issueFor(User user) {
        String raw = newRawToken();
        save(user, raw);
        return raw;
    }

    @Transactional
    public Rotation rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw unauthorized();
        }
        String hash = hash(rawToken);
        RefreshToken current = findByRaw(rawToken, hash).orElseThrow(this::unauthorized);
        LocalDateTime now = LocalDateTime.now();

        if (current.getExpiresAt() == null || current.getExpiresAt().isBefore(now)) {
            refreshTokenRepository.delete(current);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 만료되었어요. 다시 로그인해 주세요.");
        }

        User user = current.getUser();

        if (current.getRevokedAt() != null) {
            boolean withinGrace = current.getRevokedAt().plusSeconds(GRACE_SECONDS).isAfter(now);
            if (withinGrace) {
                // 같은 순간 여러 요청이 갱신한 경우: 방금 만든 새 토큰을 그대로 준다.
                GraceEntry cached = graceCache.get(hash);
                if (cached != null) {
                    return Rotation.of(cached.rawToken(), user);
                }
                // 캐시가 없으면(서버 재시작·다른 인스턴스) 새 토큰을 하나 더 준다.
                String raw = newRawToken();
                save(user, raw);
                return Rotation.of(raw, user);
            }
            // 유예 시간이 지난 폐기 토큰이 다시 왔다 = 누군가 예전 토큰을 들고 있다. 전부 끊는다.
            log.warn("Refresh token reuse detected for user id={}", user.getId());
            refreshTokenRepository.deleteByUser_Id(user.getId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "보안을 위해 다시 로그인해 주세요.");
        }

        String newRaw = newRawToken();
        String newHash = save(user, newRaw);
        current.setRevokedAt(now);
        current.setReplacedBy(newHash);
        refreshTokenRepository.save(current);
        graceCache.put(hash, new GraceEntry(newRaw, now));
        return Rotation.of(newRaw, user);
    }

    /** 로그아웃: 이 토큰의 주인이 가진 리프레시 토큰을 모두 지운다. 토큰이 이상해도 예외를 던지지 않는다. */
    @Transactional
    public void revokeByToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        findByRaw(rawToken, hash(rawToken))
                .map(RefreshToken::getUser)
                .ifPresent(u -> refreshTokenRepository.deleteByUser_Id(u.getId()));
    }

    @Transactional
    public void revokeAllByUserEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자 없음"));
        refreshTokenRepository.deleteByUser_Id(user.getId());
    }

    /** 매일 새벽 4시 30분: 만료된 토큰과 폐기된 지 7일 지난 토큰을 지운다. */
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    public void purgeStale() {
        LocalDateTime now = LocalDateTime.now();
        int removed = refreshTokenRepository.deleteStale(now, now.minusDays(REVOKED_RETENTION_DAYS));
        if (removed > 0) {
            log.info("Purged {} stale refresh tokens", removed);
        }
        graceCache.entrySet().removeIf(e -> e.getValue().createdAt().plusSeconds(GRACE_SECONDS).isBefore(now));
    }

    @Scheduled(fixedDelay = 60_000L)
    public void evictGraceCache() {
        LocalDateTime now = LocalDateTime.now();
        graceCache.entrySet().removeIf(e -> e.getValue().createdAt().plusSeconds(GRACE_SECONDS).isBefore(now));
    }

    private Optional<RefreshToken> findByRaw(String raw, String hash) {
        Optional<RefreshToken> found = refreshTokenRepository.findByToken(hash);
        if (found.isPresent()) return found;
        // 이번 변경 전에 발급된 행(원문 JWT 저장). 첫 갱신 때 해시 행으로 바뀐다.
        if (raw.length() <= 512) {
            return refreshTokenRepository.findByToken(raw);
        }
        return Optional.empty();
    }

    private String save(User user, String raw) {
        String hash = hash(raw);
        LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(jwtUtil.getRefreshTokenExpirationMs() / 1000L);
        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .token(hash)
                .expiresAt(expiresAt)
                .build());
        return hash;
    }

    private static String newRawToken() {
        byte[] bytes = new byte[32];
        RND.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요.");
    }
}
