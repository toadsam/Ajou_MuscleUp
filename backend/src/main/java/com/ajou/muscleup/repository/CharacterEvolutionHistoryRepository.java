package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CharacterEvolutionHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterEvolutionHistoryRepository extends JpaRepository<CharacterEvolutionHistory, Long> {
}
