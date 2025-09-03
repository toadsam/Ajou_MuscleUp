package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.review.*;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;

public interface ReviewService {
    ReviewResponse create(ReviewCreateRequest req);
    Page<ReviewResponse> listByProtein(Long proteinId, Pageable pageable);
    void delete(Long reviewId, Long requesterUserId);
}
