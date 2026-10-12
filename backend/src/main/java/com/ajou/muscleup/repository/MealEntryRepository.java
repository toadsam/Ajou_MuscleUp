package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.MealEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MealEntryRepository extends JpaRepository<MealEntry, Long> {
    List<MealEntry> findAllByUser_IdAndEatenOnOrderByCreatedAtAsc(Long userId, LocalDate eatenOn);

    List<MealEntry> findAllByUser_IdAndEatenOnBetween(Long userId, LocalDate from, LocalDate to);

    long countByUser_IdAndEatenOn(Long userId, LocalDate eatenOn);

    Optional<MealEntry> findByIdAndUser_Id(Long id, Long userId);

    List<MealEntry> findAllByUser_IdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}
