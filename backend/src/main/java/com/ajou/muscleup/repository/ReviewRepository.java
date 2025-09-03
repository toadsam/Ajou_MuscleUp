package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Review;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query; import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Page<Review> findByProtein_Id(Long proteinId, Pageable pageable);

    @Query("select avg(r.rating) from Review r where r.protein.id = :pid")
    Double avgRatingByProteinId(@Param("pid") Long proteinId);
}
