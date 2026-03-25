package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserBodyStatsRepository extends JpaRepository<UserBodyStats, Long> {
    Optional<UserBodyStats> findByUser(User user);

    @Query("""
            select coalesce(sum(
              coalesce(s.benchKg, 0) + coalesce(s.squatKg, 0) + coalesce(s.deadliftKg, 0)
            ), 0)
            from UserBodyStats s
            """)
    Double sumThreeLiftTotal();
}
