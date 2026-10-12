package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.PushLog;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PushLogRepository extends JpaRepository<PushLog, Long> {
    long countByUser_IdAndSentOnAndTypeNot(Long userId, LocalDate sentOn, String type);

    long countByUser_IdAndSentOnAndType(Long userId, LocalDate sentOn, String type);

    @Modifying
    @Query("delete from PushLog l where l.sentOn < :before")
    int deleteBySentOnBefore(@Param("before") LocalDate before);
}
