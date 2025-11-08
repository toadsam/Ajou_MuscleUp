package com.ajou.muscleup.dto.support;

import com.ajou.muscleup.entity.Inquiry;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class InquiryResponse {
    private Long id;

    public static InquiryResponse from(Inquiry i) {
        return new InquiryResponse(i.getId());
    }
}

