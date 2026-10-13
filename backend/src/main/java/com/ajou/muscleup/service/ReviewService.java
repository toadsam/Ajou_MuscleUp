package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.review.*;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;

public interface ReviewService {
    ReviewResponse create(String userEmail, ReviewCreateRequest req);
    /** proteinId 가 null 이면 전체 후기. viewerEmail 은 mine 표시용(비로그인이면 null) */
    Page<ReviewResponse> listByProtein(Long proteinId, Pageable pageable, String viewerEmail);
    /** 평균 평점 · 후기 수(목록 페이지와 상관없이 전체). proteinId 가 null 이면 모든 후기 */
    ReviewSummary summary(Long proteinId);

    record ReviewSummary(double avg, long count) {}
    ReviewResponse update(Long reviewId, String userEmail, ReviewUpdateRequest req);
    void delete(Long reviewId, String userEmail);
}
