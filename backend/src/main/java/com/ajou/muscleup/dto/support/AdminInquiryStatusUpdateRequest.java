package com.ajou.muscleup.dto.support;

import com.ajou.muscleup.entity.InquiryStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class AdminInquiryStatusUpdateRequest {
    @NotNull
    private InquiryStatus status;

    @Size(max = 1000)
    private String adminNote;
}
