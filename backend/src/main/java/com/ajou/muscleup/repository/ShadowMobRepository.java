package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ShadowMob;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShadowMobRepository extends JpaRepository<ShadowMob, Long> {
    List<ShadowMob> findAllByWeek_IdOrderBySlotAsc(Long weekId);

    Optional<ShadowMob> findByIdAndUser_Id(Long id, Long userId);

    /** 이 종류를 처음 잡는지(도감 몬스터 카드) */
    long countByUser_IdAndCodeAndKilledAtIsNotNull(Long userId, String code);

    /** 누적 잡몹 처치(꾸미기 MOB_KILLS — D3) */
    long countByUser_IdAndKilledAtIsNotNull(Long userId);
}
