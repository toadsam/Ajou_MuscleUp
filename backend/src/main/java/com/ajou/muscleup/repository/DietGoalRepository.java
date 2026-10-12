package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.DietGoal;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietGoalRepository extends JpaRepository<DietGoal, Long> {
    Optional<DietGoal> findByUser_Id(Long userId);
}
