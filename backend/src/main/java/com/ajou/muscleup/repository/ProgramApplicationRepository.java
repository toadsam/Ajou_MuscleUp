package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ProgramApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProgramApplicationRepository extends JpaRepository<ProgramApplication, Long> {
    List<ProgramApplication> findAllByOrderByCreatedAtDesc();
}
