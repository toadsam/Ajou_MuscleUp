package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.MealEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MealEntryRepository extends JpaRepository<MealEntry, Long> {
    List<MealEntry> findAllByUser_IdAndEatenOnOrderByCreatedAtAsc(Long userId, LocalDate eatenOn);

    List<MealEntry> findAllByUser_IdAndEatenOnBetween(Long userId, LocalDate from, LocalDate to);

    long countByUser_IdAndEatenOn(Long userId, LocalDate eatenOn);

    Optional<MealEntry> findByIdAndUser_Id(Long id, Long userId);

    List<MealEntry> findAllByUser_IdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /** 식단을 기록한 날 수 */
    @Query("select count(distinct m.eatenOn) from MealEntry m where m.user.id = :userId")
    long countDaysByUserId(@Param("userId") Long userId);
}
