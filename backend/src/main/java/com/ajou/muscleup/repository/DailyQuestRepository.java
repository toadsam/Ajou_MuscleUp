package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.DailyQuest;
import java.time.LocalDate;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyQuestRepository extends JpaRepository<DailyQuest, Long> {
    Optional<DailyQuest> findByUser_IdAndQuestDate(Long userId, LocalDate questDate);

    /** 보너스를 두 번 주지 않게 행을 잠그고 읽는다 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from DailyQuest q where q.user.id = :userId and q.questDate = :date")
    Optional<DailyQuest> findForUpdate(@Param("userId") Long userId, @Param("date") LocalDate date);
}
