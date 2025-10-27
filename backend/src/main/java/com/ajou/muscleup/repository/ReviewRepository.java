package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Review;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query; import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Page<Review> findByProtein_Id(Long proteinId, Pageable pageable);

    // 리뷰가 없으면 null이 되므로 0으로 치환해 NPE/언박싱 오류 방지
    @Query("select coalesce(avg(r.rating), 0) from Review r where r.protein.id = :pid")
    double avgRatingByProteinId(@Param("pid") Long proteinId);
}
