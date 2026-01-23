package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceLogRepository extends JpaRepository<AttendanceLog, Long> {
    Optional<AttendanceLog> findByUserAndDate(User user, LocalDate date);

    List<AttendanceLog> findAllByUserAndDateBetweenOrderByDateAsc(User user, LocalDate start, LocalDate end);

    long countByUserAndDidWorkoutTrueAndDateBetween(User user, LocalDate start, LocalDate end);

    long countByDate(LocalDate date);
}
