package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.RunSession;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RunSessionRepository extends JpaRepository<RunSession, Long> {
    List<RunSession> findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(Long userId, LocalDate from, LocalDate to);

    Optional<RunSession> findByIdAndUser_Id(Long id, Long userId);

    long countByUser_IdAndPerformedOn(Long userId, LocalDate performedOn);

    /** 기록 비교용 — 이 사람의 모든 러닝(id 빼고) */
    @Query("select r from RunSession r where r.user.id = :userId and r.id <> :exceptId")
    List<RunSession> findAllByUserExcept(@Param("userId") Long userId, @Param("exceptId") Long exceptId);

    List<RunSession> findAllByUser_Id(Long userId);

    long countByUser_Id(Long userId);

    @Query("select coalesce(sum(r.distanceM), 0) from RunSession r where r.user.id = :userId")
    long sumDistanceByUserId(@Param("userId") Long userId);
}
