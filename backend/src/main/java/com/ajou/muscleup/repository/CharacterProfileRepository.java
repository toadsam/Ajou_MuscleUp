package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.User;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CharacterProfileRepository extends JpaRepository<CharacterProfile, Long> {
    Optional<CharacterProfile> findByUser(User user);

    Page<CharacterProfile> findByIsPublicTrueOrderByLevelDescUpdatedAtDesc(Pageable pageable);

    @Query("""
        select cp, s
        from CharacterProfile cp
        left join UserBodyStats s on s.user = cp.user
        where cp.isPublic = true
        order by (coalesce(s.benchKg, 0) + coalesce(s.squatKg, 0) + coalesce(s.deadliftKg, 0)) desc, cp.updatedAt desc
        """)
    Page<Object[]> findPublicWithStatsOrderByThreeLiftDesc(Pageable pageable);
}
