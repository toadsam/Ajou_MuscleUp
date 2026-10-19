package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ShadowCharge;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShadowChargeRepository extends JpaRepository<ShadowCharge, Long> {
    List<ShadowCharge> findAllByWeek_IdOrderByIdAsc(Long weekId);

    List<ShadowCharge> findAllBySourceAndSourceId(String source, Long sourceId);

    /** 그 주 · 그 날에 이미 모은 힘(상한 전 값)의 합 — 하루 상한 계산용 */
    @Query("select coalesce(sum(c.raw), 0) from ShadowCharge c where c.week.id = :weekId and c.hitOn = :day")
    long sumRawByWeekAndDay(@Param("weekId") Long weekId, @Param("day") LocalDate day);
}
