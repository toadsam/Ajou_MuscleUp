package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.protein.ProteinShareApplicationResponse;
import com.ajou.muscleup.dto.protein.ProteinShareMessageResponse;
import com.ajou.muscleup.dto.protein.ProteinShareSummaryResponse;
import com.ajou.muscleup.entity.ProteinShareStatus;
import java.util.List;

public interface ProteinShareService {
    ProteinShareApplicationResponse apply(Long proteinId, String email);
    ProteinShareApplicationResponse getMyApplication(Long proteinId, String email);
    List<ProteinShareApplicationResponse> listApplications(Long proteinId, String email);
    ProteinShareApplicationResponse updateStatus(Long proteinId, Long appId, ProteinShareStatus status, String email);
    ProteinShareSummaryResponse getSummary(Long proteinId);
    List<ProteinShareMessageResponse> listMessages(Long proteinId, String email);
    ProteinShareMessageResponse postMessage(Long proteinId, String email, String content);
}
