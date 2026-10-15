package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CustomActivity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomActivityRepository extends JpaRepository<CustomActivity, Long> {
    List<CustomActivity> findAllByUser_IdAndDeletedFalseOrderByIdAsc(Long userId);

    Optional<CustomActivity> findByIdAndUser_Id(Long id, Long userId);

    long countByUser_IdAndDeletedFalse(Long userId);

    boolean existsByUser_IdAndNameAndDeletedFalse(Long userId, String name);
}
