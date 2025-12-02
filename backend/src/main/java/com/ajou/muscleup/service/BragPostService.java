package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragPostCreateRequest;
import com.ajou.muscleup.dto.brag.BragPostResponse;
import com.ajou.muscleup.dto.brag.BragPostUpdateRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BragPostService {
    BragPostResponse create(String userEmail, BragPostCreateRequest req);
    Page<BragPostResponse> list(Pageable pageable);
    BragPostResponse get(Long id);
    BragPostResponse update(Long id, String userEmail, BragPostUpdateRequest req);
    void delete(Long id, String userEmail);
}
