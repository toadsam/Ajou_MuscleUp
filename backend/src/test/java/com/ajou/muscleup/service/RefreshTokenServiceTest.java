package com.ajou.muscleup.service;

import com.ajou.muscleup.config.JwtUtil;
import com.ajou.muscleup.entity.RefreshToken;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.RefreshTokenRepository;
import com.ajou.muscleup.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** 리프레시 토큰 회전 · 유예 · 재사용 탐지 · 만료 확인 (DB 없이 메모리 저장소로). */
class RefreshTokenServiceTest {

    private final List<RefreshToken> rows = new ArrayList<>();
    private RefreshTokenService service;
    private User user;

    @BeforeEach
    void setUp() {
        RefreshTokenRepository repo = mock(RefreshTokenRepository.class);
        when(repo.save(any(RefreshToken.class))).thenAnswer(inv -> {
            RefreshToken rt = inv.getArgument(0);
            if (!rows.contains(rt)) rows.add(rt);
            return rt;
        });
        when(repo.findByToken(anyString())).thenAnswer(inv ->
                rows.stream().filter(r -> r.getToken().equals(inv.getArgument(0))).findFirst());
        doAnswer(inv -> { rows.removeIf(r -> r.getUser().getId().equals(inv.getArgument(0))); return null; })
                .when(repo).deleteByUser_Id(anyLong());
        doAnswer(inv -> { rows.remove((RefreshToken) inv.getArgument(0)); return null; })
                .when(repo).delete(any(RefreshToken.class));

        JwtUtil jwt = mock(JwtUtil.class);
        when(jwt.getRefreshTokenExpirationMs()).thenReturn(14L * 24 * 3600 * 1000);

        service = new RefreshTokenService(repo, mock(UserRepository.class), jwt);
        user = new User();
        user.setId(1L);
        user.setEmail("rt-test@example.com");
        user.setRole("ROLE_USER");
    }

    @Test
    void storesOnlyHashAndRotatesToNewToken() {
        String first = service.issueFor(user);
        assertTrue(rows.stream().noneMatch(r -> r.getToken().equals(first)), "원문이 DB 에 저장되면 안 된다");

        RefreshTokenService.Rotation r1 = service.rotate(first);
        assertNotEquals(first, r1.token(), "회전하면 새 토큰이어야 한다");
        assertEquals("rt-test@example.com", r1.email());

        // 유예 시간 안에 같은 이전 토큰이 다시 오면(동시 갱신) 같은 새 토큰을 돌려준다.
        RefreshTokenService.Rotation again = service.rotate(first);
        assertEquals(r1.token(), again.token());

        // 새 토큰으로는 계속 갱신된다.
        RefreshTokenService.Rotation r2 = service.rotate(r1.token());
        assertNotEquals(r1.token(), r2.token());
    }

    @Test
    void reuseAfterGraceRevokesAllTokens() {
        String first = service.issueFor(user);
        RefreshTokenService.Rotation r1 = service.rotate(first);
        // 이전 토큰이 유예 시간보다 오래전에 폐기된 것으로 만든다.
        rows.stream().filter(r -> r.getRevokedAt() != null)
                .forEach(r -> r.setRevokedAt(LocalDateTime.now().minusMinutes(5)));

        assertThrows(ResponseStatusException.class, () -> service.rotate(first));
        // 재사용이 감지되면 새 토큰까지 모두 끊긴다.
        assertTrue(rows.isEmpty());
        assertThrows(ResponseStatusException.class, () -> service.rotate(r1.token()));
    }

    @Test
    void expiredTokenIsRejected() {
        String first = service.issueFor(user);
        rows.forEach(r -> r.setExpiresAt(LocalDateTime.now().minusSeconds(1)));
        assertThrows(ResponseStatusException.class, () -> service.rotate(first));
    }

    @Test
    void logoutWithGarbageTokenDoesNotThrow() {
        assertDoesNotThrow(() -> service.revokeByToken("eyJhbGciOiJIUzI1NiJ9.garbage.sig"));
        assertDoesNotThrow(() -> service.revokeByToken(null));
    }

    @Test
    void unknownTokenIsRejected() {
        assertThrows(ResponseStatusException.class, () -> service.rotate("does-not-exist"));
    }
}
