package com.ajou.muscleup.dto.support;

import com.ajou.muscleup.entity.Inquiry;
import com.ajou.muscleup.entity.InquiryStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AdminInquiryResponse {
    private Long id;
    private String name;
    private String email;
    private String message;
    private String page;
    private Long userId;
    private InquiryStatus status;
    private String adminNote;
    private LocalDateTime handledAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static AdminInquiryResponse from(Inquiry inquiry) {
        return new AdminInquiryResponse(
                inquiry.getId(),
                inquiry.getName(),
                inquiry.getEmail(),
                inquiry.getMessage(),
                inquiry.getPage(),
                inquiry.getUserId(),
                inquiry.getStatus() == null ? InquiryStatus.OPEN : inquiry.getStatus(),
                inquiry.getAdminNote(),
                inquiry.getHandledAt(),
                inquiry.getCreatedAt(),
                inquiry.getUpdatedAt()
        );
    }
}
