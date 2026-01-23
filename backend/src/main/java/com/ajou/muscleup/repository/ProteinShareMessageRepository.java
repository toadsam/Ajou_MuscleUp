package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ProteinShareMessage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProteinShareMessageRepository extends JpaRepository<ProteinShareMessage, Long> {
    List<ProteinShareMessage> findByProteinIdOrderByCreatedAtAsc(Long proteinId);
}
