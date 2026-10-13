package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.GymDecorSlot;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GymDecorSlotRepository extends JpaRepository<GymDecorSlot, Long> {
    List<GymDecorSlot> findAllByUser_Id(Long userId);
}
