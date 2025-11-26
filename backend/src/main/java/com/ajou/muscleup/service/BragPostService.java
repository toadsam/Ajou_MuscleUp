package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragPostCreateRequest;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BragPostService {
    BragPostResponse create(String userEmail, BragPostCreateRequest req);
    Page<BragPostResponse> list(Pageable pageable);
    BragPostResponse get(Long id);
}
