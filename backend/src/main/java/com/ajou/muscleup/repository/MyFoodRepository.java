package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.MyFood;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MyFoodRepository extends JpaRepository<MyFood, Long> {
    List<MyFood> findAllByUser_IdOrderByNameAsc(Long userId);

    Optional<MyFood> findByIdAndUser_Id(Long id, Long userId);

    long countByUser_Id(Long userId);
}
