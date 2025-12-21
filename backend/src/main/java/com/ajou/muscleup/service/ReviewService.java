package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.review.*;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;

public interface ReviewService {
    ReviewResponse create(String userEmail, ReviewCreateRequest req);
    Page<ReviewResponse> listByProtein(Long proteinId, Pageable pageable);
    ReviewResponse update(Long reviewId, String userEmail, ReviewUpdateRequest req);
    void delete(Long reviewId, String userEmail);
}
