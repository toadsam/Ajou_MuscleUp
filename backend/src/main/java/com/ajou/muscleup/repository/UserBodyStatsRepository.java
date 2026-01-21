package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserBodyStatsRepository extends JpaRepository<UserBodyStats, Long> {
    Optional<UserBodyStats> findByUser(User user);
}
