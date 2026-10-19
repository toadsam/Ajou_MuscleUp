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

    /** 지난 주 이전인데 아직 정산 안 된 주(남은 힘을 자동 공격으로) — 한 사람 것 · 전체 */
    List<ShadowWeek> findAllByUser_IdAndSettledFalseAndWeekStartBefore(Long userId, LocalDate weekStart);

    List<ShadowWeek> findAllBySettledFalseAndWeekStartBefore(LocalDate weekStart);
}
