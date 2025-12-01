package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.BragPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BragPostRepository extends JpaRepository<BragPost, Long> {
    Page<BragPost> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
