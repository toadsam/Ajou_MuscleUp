package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.support.InquiryRequest;
import com.ajou.muscleup.dto.support.InquiryResponse;
import com.ajou.muscleup.dto.support.SupportChatRequest;
import com.ajou.muscleup.dto.support.SupportChatResponse;
import com.ajou.muscleup.entity.Inquiry;
import com.ajou.muscleup.repository.InquiryRepository;
import com.ajou.muscleup.service.SupportChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final InquiryRepository inquiryRepository;
    private final SupportChatService supportChatService;

    @PostMapping("/inquiries")
    public ResponseEntity<InquiryResponse> create(@Valid @RequestBody InquiryRequest req) {
        Inquiry saved = inquiryRepository.save(Inquiry.builder()
                .name(req.getName())
                .email(req.getEmail())
                .message(req.getMessage())
                .page(req.getPage())
                .userId(req.getUserId())
                .build());
        return ResponseEntity.ok(InquiryResponse.from(saved));
    }

    @PostMapping("/chat")
    public ResponseEntity<SupportChatResponse> chat(@Valid @RequestBody SupportChatRequest req) {
        String answer = supportChatService.answer(req.getMessage(), req.getPage());
        return ResponseEntity.ok(new SupportChatResponse(answer));
    }
}

