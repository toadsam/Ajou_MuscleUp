package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ShadowWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShadowWeekRepository extends JpaRepository<ShadowWeek, Long> {
    Optional<ShadowWeek> findByUser_IdAndWeekStart(Long userId, LocalDate weekStart);

    List<ShadowWeek> findAllByUser_IdAndWeekStartBetween(Long userId, LocalDate from, LocalDate to);

    List<ShadowWeek> findAllByUser_IdAndWeekStartBetweenOrderByWeekStartDesc(Long userId, LocalDate from, LocalDate to);

    long countByUser_IdAndKilledAtIsNotNull(Long userId);
}
