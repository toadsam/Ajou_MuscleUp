package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Protein;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProteinRepository extends JpaRepository<Protein, Long> {
    Page<Protein> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
