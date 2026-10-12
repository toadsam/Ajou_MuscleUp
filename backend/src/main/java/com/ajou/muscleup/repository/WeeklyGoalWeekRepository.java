package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.WeeklyGoalWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyGoalWeekRepository extends JpaRepository<WeeklyGoalWeek, Long> {
    Optional<WeeklyGoalWeek> findByUser_IdAndWeekStart(Long userId, LocalDate weekStart);

    List<WeeklyGoalWeek> findAllByUser_IdAndWeekStartBetween(Long userId, LocalDate from, LocalDate to);
}
