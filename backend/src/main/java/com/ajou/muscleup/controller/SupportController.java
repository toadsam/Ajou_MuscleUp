package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.support.InquiryRequest;
import com.ajou.muscleup.dto.support.InquiryResponse;
import com.ajou.muscleup.dto.support.SupportChatRequest;
import com.ajou.muscleup.dto.support.SupportChatResponse;
import com.ajou.muscleup.entity.InquiryStatus;
import com.ajou.muscleup.entity.Inquiry;
import com.ajou.muscleup.repository.InquiryRepository;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.security.RateLimiter;
import com.ajou.muscleup.service.SupportChatService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final InquiryRepository inquiryRepository;
    private final SupportChatService supportChatService;
    private final UserRepository userRepository;
    private final RateLimiter rateLimiter;

    @PostMapping("/inquiries")
    public ResponseEntity<InquiryResponse> create(@Valid @RequestBody InquiryRequest req,
                                                  @AuthenticationPrincipal String email,
                                                  HttpServletRequest request) {
        rateLimiter.check("support-inquiry-ip:" + request.getRemoteAddr(), 5, Duration.ofMinutes(10),
                "문의가 너무 자주 접수되고 있어요. 잠시 후 다시 보내 주세요.");
        // userId 는 본문 값을 믿지 않고 로그인한 사람에게서만 채운다(비로그인 문의는 null).
        Long userId = !isLoggedIn(email)
                ? null
                : userRepository.findByEmail(email).map(User::getId).orElse(null);
        Inquiry saved = inquiryRepository.save(Inquiry.builder()
                .name(req.getName())
                .email(req.getEmail())
                .message(req.getMessage())
                .page(req.getPage())
                .userId(userId)
                .status(InquiryStatus.OPEN)
                .build());
        return ResponseEntity.ok(InquiryResponse.from(saved));
    }

    @PostMapping("/chat")
    public ResponseEntity<SupportChatResponse> chat(@Valid @RequestBody SupportChatRequest req,
                                                    @AuthenticationPrincipal String email,
                                                    HttpServletRequest request) {
        // 비로그인도 쓰는 AI 안내 챗봇이라 IP 기준으로 막고, 로그인했으면 사람 기준으로도 막는다.
        rateLimiter.check("support-chat-ip:" + request.getRemoteAddr(), 10, Duration.ofMinutes(1),
                "질문이 너무 빨라요. 잠시 후 다시 물어봐 주세요.");
        rateLimiter.check("support-chat-ip-day:" + request.getRemoteAddr(), 200, Duration.ofDays(1),
                "오늘 안내 챗봇 사용 한도를 넘었어요. 내일 다시 이용해 주세요.");
        if (isLoggedIn(email)) {
            rateLimiter.check("support-chat-user:" + email, 10, Duration.ofMinutes(1),
                    "질문이 너무 빨라요. 잠시 후 다시 물어봐 주세요.");
        }
        String answer = supportChatService.answer(req.getMessage(), req.getPage());
        return ResponseEntity.ok(new SupportChatResponse(answer));
    }

    /** permitAll 경로에서 비로그인이면 principal 이 "anonymousUser" 문자열로 들어온다. */
    private static boolean isLoggedIn(String email) {
        return email != null && !email.isBlank() && !"anonymousUser".equals(email);
    }
}

