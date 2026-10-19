package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ShadowHit;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShadowHitRepository extends JpaRepository<ShadowHit, Long> {
    List<ShadowHit> findAllByWeek_IdOrderByIdAsc(Long weekId);

    List<ShadowHit> findAllBySourceAndSourceId(String source, Long sourceId);

    /** 그 주 · 그 날에 이미 들어간 힘(상한 전 값)의 합 — 하루 상한 계산용 */
    @Query("select coalesce(sum(h.raw), 0) from ShadowHit h where h.week.id = :weekId and h.hitOn = :day")
    long sumRawByWeekAndDay(@Param("weekId") Long weekId, @Param("day") LocalDate day);
}
