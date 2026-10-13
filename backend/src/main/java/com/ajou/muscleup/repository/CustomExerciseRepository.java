package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CustomExercise;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomExerciseRepository extends JpaRepository<CustomExercise, Long> {
    List<CustomExercise> findAllByUser_IdAndDeletedFalseOrderByIdAsc(Long userId);

    Optional<CustomExercise> findByIdAndUser_Id(Long id, Long userId);

    long countByUser_IdAndDeletedFalse(Long userId);
}
