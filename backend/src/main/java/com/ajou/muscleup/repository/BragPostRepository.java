package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;

public interface BragPostRepository extends JpaRepository<BragPost, Long> {
    Page<BragPost> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<BragPost> findByVisibilityOrUser_IdInOrderByCreatedAtDesc(
            BragVisibility visibility,
            Collection<Long> userIds,
            Pageable pageable
    );
}
