package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.WeeklyGoalSetting;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyGoalSettingRepository extends JpaRepository<WeeklyGoalSetting, Long> {
    Optional<WeeklyGoalSetting> findByUser_Id(Long userId);
}
