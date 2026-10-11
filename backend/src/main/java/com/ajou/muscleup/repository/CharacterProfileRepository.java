package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.User;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CharacterProfileRepository extends JpaRepository<CharacterProfile, Long> {
    Optional<CharacterProfile> findByUser(User user);
    List<CharacterProfile> findAllByUserIn(Collection<User> users);

    // 랭킹 행마다 user(닉네임)를 따로 읽지 않게 함께 가져온다(N+1 방지).
    @EntityGraph(attributePaths = "user")
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

    // row = [CharacterProfile, UserBodyStats(없으면 null), User]. User 를 같이 골라 행마다 닉네임 조회(N+1)를 없앴다.
    @Query(value = """
        select cp, s, u
        from CharacterProfile cp
        join cp.user u
        left join UserBodyStats s on s.user = cp.user
        where cp.isPublic = true
        order by (coalesce(s.benchKg, 0) + coalesce(s.squatKg, 0) + coalesce(s.deadliftKg, 0)) desc, cp.updatedAt desc
        """,
        countQuery = "select count(cp) from CharacterProfile cp where cp.isPublic = true")
    Page<Object[]> findPublicWithStatsOrderByThreeLiftDesc(Pageable pageable);
}
