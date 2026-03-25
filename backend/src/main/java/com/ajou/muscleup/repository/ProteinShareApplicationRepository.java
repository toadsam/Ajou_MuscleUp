package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ProteinShareApplication;
import com.ajou.muscleup.entity.ProteinShareStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProteinShareApplicationRepository extends JpaRepository<ProteinShareApplication, Long> {
    Optional<ProteinShareApplication> findByProteinIdAndUserId(Long proteinId, Long userId);
    List<ProteinShareApplication> findByProteinIdOrderByCreatedAtDesc(Long proteinId);
    long countByProteinIdAndStatus(Long proteinId, ProteinShareStatus status);
}
