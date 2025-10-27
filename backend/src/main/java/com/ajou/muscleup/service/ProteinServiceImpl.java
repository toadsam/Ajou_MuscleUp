package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.protein.ProteinCreateUpdateRequest;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.repository.ProteinRepository;
import com.ajou.muscleup.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException; import org.springframework.http.HttpStatus;

@Service
@RequiredArgsConstructor
@Transactional
public class ProteinServiceImpl implements ProteinService {
    private final ProteinRepository proteinRepository;
    private final ReviewRepository reviewRepository;

    @Override
    public Protein create(ProteinCreateUpdateRequest req) {
        Protein p = Protein.builder()
                .name(req.getName()).price(req.getPrice()).days(req.getDays()).goal(req.getGoal())
                .imageUrl(req.getImageUrl()).description(req.getDescription()).category(req.getCategory())
                .build();
        return proteinRepository.save(p);
    }

    @Override
    public Protein update(Long id, ProteinCreateUpdateRequest req) {
        Protein p = get(id);
        if (req.getName() != null) p.setName(req.getName());
        if (req.getPrice() != null) p.setPrice(req.getPrice());
        if (req.getDays() != null) p.setDays(req.getDays());
        if (req.getGoal() != null) p.setGoal(req.getGoal());
        if (req.getImageUrl() != null) p.setImageUrl(req.getImageUrl());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getCategory() != null) p.setCategory(req.getCategory());
        return p; // dirty checking
    }

    @Override public void delete(Long id) { proteinRepository.delete(get(id)); }

    @Override @Transactional(readOnly = true)
    public Protein get(Long id) {
        return proteinRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Protein not found"));
    }

    @Override @Transactional(readOnly = true)
    public Page<Protein> list(String q, Pageable pageable) {
        if (q == null || q.isBlank()) return proteinRepository.findAll(pageable);
        return proteinRepository.findByNameContainingIgnoreCase(q, pageable);
    }

    @Override @Transactional(readOnly = true)
    public double averageRating(Long proteinId) { return reviewRepository.avgRatingByProteinId(proteinId); }
}
