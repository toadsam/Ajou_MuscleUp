package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ActivityLog;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    @EntityGraph(attributePaths = "activity")
    List<ActivityLog> findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(Long userId, LocalDate from, LocalDate to);

    Optional<ActivityLog> findByIdAndUser_Id(Long id, Long userId);

    long countByUser_IdAndPerformedOn(Long userId, LocalDate performedOn);
}
