package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.push.PushService;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 웹 푸시 알림.
 *   GET  /api/push/config        켜져 있는지 · 공개 키(로그인 없이)
 *   GET  /api/push/me            내 구독 기기 수 · 종류별 설정 · 오늘 보낸 수
 *   POST /api/push/subscribe     {endpoint, keys: {p256dh, auth}}
 *   POST /api/push/unsubscribe   {endpoint}
 *   PUT  /api/push/preferences   {reminder, weekly, social}
 *   POST /api/push/test          나에게 시험 알림(하루 3번)
 */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {
    private final PushService pushService;
    private final UserRepository userRepository;

    public record Keys(String p256dh, String auth) {}

    public record SubscribeRequest(String endpoint, Keys keys) {}

    public record EndpointRequest(String endpoint) {}

    public record TestResult(int delivered) {}

    @GetMapping("/config")
    public PushService.Config config() {
        return pushService.config();
    }

    @GetMapping("/me")
    public PushService.Me me(@AuthenticationPrincipal String email) {
        return pushService.me(user(email));
    }

    @PostMapping("/subscribe")
    public PushService.Me subscribe(@AuthenticationPrincipal String email, @RequestBody SubscribeRequest req) {
        if (req == null || req.keys() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 구독 정보가 맞지 않아요.");
        return pushService.subscribe(user(email), req.endpoint(), req.keys().p256dh(), req.keys().auth());
    }

    @PostMapping("/unsubscribe")
    public PushService.Me unsubscribe(@AuthenticationPrincipal String email, @RequestBody EndpointRequest req) {
        return pushService.unsubscribe(user(email), req == null ? null : req.endpoint());
    }

    @PutMapping("/preferences")
    public PushService.Me preferences(@AuthenticationPrincipal String email, @RequestBody PushService.Preferences req) {
        if (req == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "설정을 보내 주세요.");
        return pushService.setPreferences(user(email), req);
    }

    @PostMapping("/test")
    public TestResult test(@AuthenticationPrincipal String email) {
        User me = user(email);
        return new TestResult(pushService.send(me.getId(), PushService.Type.TEST,
                new PushService.Message("득근득근 알림", "알림이 잘 와요! 운동할 시간에 알려 드릴게요.", "/", "test")));
    }

    private User user(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
