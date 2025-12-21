package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.BragComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BragCommentRepository extends JpaRepository<BragComment, Long> {
    List<BragComment> findByBragPost_IdOrderByCreatedAtAsc(Long postId);
    List<BragComment> findTop20ByUser_IdOrderByCreatedAtDesc(Long userId);
    void deleteByBragPost_Id(Long postId);
}
