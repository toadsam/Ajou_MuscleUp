package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.WorkoutSession;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutSessionRepository extends JpaRepository<WorkoutSession, Long> {
    List<WorkoutSession> findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(Long userId, LocalDate from, LocalDate to);

    Optional<WorkoutSession> findByIdAndUser_Id(Long id, Long userId);

    long countByUser_IdAndPerformedOn(Long userId, LocalDate performedOn);

    /** 이 종목을 한 가장 최근 세션들(지난번 값 미리 채우기) */
    @Query("select distinct s from WorkoutSession s join s.sets x where s.user.id = :userId and x.exercise = :exercise order by s.startedAt desc")
    List<WorkoutSession> findRecentWithExercise(@Param("userId") Long userId, @Param("exercise") String exercise, Pageable pageable);
}
