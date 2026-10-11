package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByUser_Id(Long userId);

    /** 만료됐거나, 폐기된 지 오래된 토큰을 지운다(정리 작업). */
    @Modifying
    @Query("delete from RefreshToken rt where rt.expiresAt < :now or (rt.revokedAt is not null and rt.revokedAt < :revokedBefore)")
    int deleteStale(@Param("now") LocalDateTime now, @Param("revokedBefore") LocalDateTime revokedBefore);
}

