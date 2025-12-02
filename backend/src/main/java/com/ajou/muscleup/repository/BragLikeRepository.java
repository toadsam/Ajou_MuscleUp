package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.BragLike;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BragLikeRepository extends JpaRepository<BragLike, Long> {
    boolean existsByBragPost_IdAndUser_Id(Long postId, Long userId);
    void deleteByBragPost_IdAndUser_Id(Long postId, Long userId);
    void deleteByBragPost_Id(Long postId);

    @Query("select count(bl) from BragLike bl where bl.bragPost.id = :pid")
    long countByPostId(@Param("pid") Long postId);

    @Query("select bl from BragLike bl join fetch bl.bragPost where bl.user.id = :uid order by bl.createdAt desc")
    List<BragLike> findRecentByUser(@Param("uid") Long userId);
}
