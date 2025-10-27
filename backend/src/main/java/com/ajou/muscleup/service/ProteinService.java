package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.protein.*;
import com.ajou.muscleup.entity.Protein;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;

public interface ProteinService {
    Protein create(ProteinCreateUpdateRequest req);
    Protein update(Long id, ProteinCreateUpdateRequest req);
    void delete(Long id);
    Protein get(Long id);
    Page<Protein> list(String q, Pageable pageable);
    double averageRating(Long proteinId);
}
