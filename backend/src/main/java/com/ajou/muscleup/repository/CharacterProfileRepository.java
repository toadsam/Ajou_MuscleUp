package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.User;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CharacterProfileRepository extends JpaRepository<CharacterProfile, Long> {
    Optional<CharacterProfile> findByUser(User user);

    Page<CharacterProfile> findByIsPublicTrueOrderByLevelDescUpdatedAtDesc(Pageable pageable);

    long countByIsPublicTrue();

    long countByIsPublicTrueAndLevelGreaterThan(int level);

    long countByIsPublicTrueAndLevelEqualsAndUpdatedAtAfter(int level, LocalDateTime updatedAt);

    @Query("""
        select count(cp)
        from CharacterProfile cp
        left join UserBodyStats s on s.user = cp.user
        where cp.isPublic = true
          and (coalesce(s.benchKg, 0) + coalesce(s.squatKg, 0) + coalesce(s.deadliftKg, 0)) > :total
        """)
    long countPublicWithThreeLiftGreaterThan(@Param("total") double total);

    @Query("""
        select count(cp)
        from CharacterProfile cp
        left join UserBodyStats s on s.user = cp.user
        where cp.isPublic = true
          and (coalesce(s.benchKg, 0) + coalesce(s.squatKg, 0) + coalesce(s.deadliftKg, 0)) = :total
          and cp.updatedAt > :updatedAt
        """)
    long countPublicWithThreeLiftEqualsAndUpdatedAtAfter(@Param("total") double total, @Param("updatedAt") LocalDateTime updatedAt);

    @Query("""
        select cp, s
        from CharacterProfile cp
        left join UserBodyStats s on s.user = cp.user
        where cp.isPublic = true
        order by (coalesce(s.benchKg, 0) + coalesce(s.squatKg, 0) + coalesce(s.deadliftKg, 0)) desc, cp.updatedAt desc
        """)
    Page<Object[]> findPublicWithStatsOrderByThreeLiftDesc(Pageable pageable);
}
