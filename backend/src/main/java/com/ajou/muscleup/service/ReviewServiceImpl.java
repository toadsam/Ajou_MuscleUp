package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.review.ReviewCreateRequest;
import com.ajou.muscleup.dto.review.ReviewResponse;
import com.ajou.muscleup.dto.review.ReviewUpdateRequest;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.Review;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.ProteinRepository;
import com.ajou.muscleup.repository.ReviewRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class ReviewServiceImpl implements ReviewService {
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final ProteinRepository proteinRepository;

    @Override
    public ReviewResponse create(String userEmail, ReviewCreateRequest req) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        Protein protein = proteinRepository.findById(req.getProteinId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "단백질 상품을 찾을 수 없습니다."));
        Review saved = reviewRepository.save(Review.builder()
                .user(user)
                .protein(protein)
                .rating(req.getRating())
                .content(req.getContent())
                .build());
        return ReviewResponse.from(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ReviewResponse> listByProtein(Long proteinId, Pageable pageable) {
        return reviewRepository.findByProtein_Id(proteinId, pageable).map(ReviewResponse::from);
    }

    @Override
    public ReviewResponse update(Long reviewId, String userEmail, ReviewUpdateRequest req) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        Review r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "후기를 찾을 수 없습니다."));
        if (!r.getUser().getId().equals(user.getId()) && !"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 후기만 수정할 수 있습니다.");
        }
        r.setRating(req.getRating());
        r.setContent(req.getContent());
        Review saved = reviewRepository.save(r);
        return ReviewResponse.from(saved);
    }

    @Override
    public void delete(Long reviewId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
        Review r = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "후기를 찾을 수 없습니다."));
        if (!r.getUser().getId().equals(user.getId()) && !"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 후기만 삭제할 수 있습니다.");
        }
        reviewRepository.delete(r);
    }
}
