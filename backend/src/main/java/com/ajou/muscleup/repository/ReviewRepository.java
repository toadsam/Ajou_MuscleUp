package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Review;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query; import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    // 작성자 · 제품 이름을 응답에 쓰므로 한 번에 가져온다(후기마다 추가 조회 방지)
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "protein"})
    Page<Review> findByProtein_Id(Long proteinId, Pageable pageable);

    // 제품을 고르지 않았을 때(전체 후기)
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "protein"})
    Page<Review> findAllBy(Pageable pageable);

    // 리뷰가 없으면 null이 되므로 0으로 치환해 NPE/언박싱 오류 방지
    @Query("select coalesce(avg(r.rating), 0) from Review r where r.protein.id = :pid")
    double avgRatingByProteinId(@Param("pid") Long proteinId);

    @Query("select count(r) from Review r where r.protein.id = :pid")
    long countByProteinId(@Param("pid") Long proteinId);

    // 전체 후기: [평균(없으면 0), 개수] 한 줄
    @Query("select coalesce(avg(r.rating), 0), count(r) from Review r")
    java.util.List<Object[]> statsAll();

    // 목록 한 페이지의 평균 평점 · 후기 수를 쿼리 한 번으로: [proteinId, avg, count]
    @Query("select r.protein.id, avg(r.rating), count(r) from Review r where r.protein.id in :ids group by r.protein.id")
    java.util.List<Object[]> ratingStatsByProteinIds(@Param("ids") java.util.Collection<Long> ids);
}
