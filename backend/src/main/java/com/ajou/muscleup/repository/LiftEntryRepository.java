package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.LiftEntry;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LiftEntryRepository extends JpaRepository<LiftEntry, Long> {
    List<LiftEntry> findAllByUser_IdAndPerformedOnOrderByIdAsc(Long userId, LocalDate performedOn);

    Optional<LiftEntry> findByIdAndUser_Id(Long id, Long userId);

    /** 개인 최고 판단용: 이 종목의 모든 기록 + 그날의 모든 종목 기록(하루 3종목 점수 한도) */
    @Query("select l from LiftEntry l where l.user.id = :userId and (l.exercise = :exercise or l.performedOn = :date)")
    List<LiftEntry> findAllByUser_IdAndExerciseOrPerformedOn(@Param("userId") Long userId, @Param("exercise") String exercise,
                                                            @Param("date") LocalDate date);

    long countByUser_IdAndPerformedOn(Long userId, LocalDate performedOn);

    /** 종목마다 최고 추정 1RM — [exercise, max(e1rm), max(weightKg)] */
    @Query("select l.exercise, max(l.e1rm), max(l.weightKg) from LiftEntry l where l.user.id = :userId group by l.exercise")
    List<Object[]> findBestsByUserId(@Param("userId") Long userId);

    /** 그래프: 날짜마다 최고 추정 1RM — [performedOn, max(e1rm)] */
    @Query("select l.performedOn, max(l.e1rm) from LiftEntry l where l.user.id = :userId and l.exercise = :exercise "
            + "and l.performedOn >= :from group by l.performedOn order by l.performedOn")
    List<Object[]> findDailyBest(@Param("userId") Long userId, @Param("exercise") String exercise, @Param("from") LocalDate from);
}
