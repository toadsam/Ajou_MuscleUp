package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.review.ReviewCreateRequest;
import com.ajou.muscleup.dto.review.ReviewResponse;
import com.ajou.muscleup.entity.*;
import com.ajou.muscleup.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class ReviewServiceImpl implements ReviewService {
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final ProteinRepository proteinRepository;

    @Override
    public ReviewResponse create(ReviewCreateRequest req) {
        User user = userRepository.findById(req.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Protein protein = proteinRepository.findById(req.getProteinId())
                .orElseThrow(() -> new IllegalArgumentException("Protein not found"));
        Review saved = reviewRepository.save(Review.builder()
                .user(user).protein(protein).rating(req.getRating()).content(req.getContent()).build());
        return ReviewResponse.from(saved);
    }

    @Override @Transactional(readOnly = true)
    public Page<ReviewResponse> listByProtein(Long proteinId, Pageable pageable) {
        return reviewRepository.findByProtein_Id(proteinId, pageable).map(ReviewResponse::from);
    }

    @Override
    public void delete(Long reviewId, Long requesterUserId) {
        Review r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found"));
        if (!r.getUser().getId().equals(requesterUserId))
            throw new IllegalArgumentException("삭제 권한이 없습니다.");
        reviewRepository.delete(r);
    }
}
