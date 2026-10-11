package com.ajou.muscleup.service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 공개 출석 공유글 "응원" 중복 방지(메모리).
 *
 * 같은 사람(로그인했으면 이메일, 아니면 IP)이 같은 글을 WINDOW 안에 다시 응원하면 숫자를 올리지 않는다.
 * - 서버 한 대 기준이다. 재시작하면 기록이 사라지고, 여러 대로 늘리면 대수만큼 허용된다.
 * - 응원은 로그인 없이 누르는 가벼운 반응이라 DB 기록 대신 메모리로 막는다(신고는 DB 로 1인 1회).
 */
@Component
public class AttendanceCheerGuard {
    static final Duration WINDOW = Duration.ofMinutes(10);
    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Map<String, Long> lastCheerAt = new ConcurrentHashMap<>();

    /** 이번 응원을 세어도 되면 true. 같은 키로 WINDOW 안에 다시 오면 false. */
    public boolean tryCheer(String viewerKey, String slug) {
        long now = System.currentTimeMillis();
        long windowMs = WINDOW.toMillis();
        if (lastCheerAt.size() > CLEANUP_THRESHOLD) {
            lastCheerAt.entrySet().removeIf(e -> now - e.getValue() >= windowMs);
        }
        String key = viewerKey + "|" + slug;
        boolean[] allowed = {false};
        lastCheerAt.compute(key, (k, prev) -> {
            if (prev == null || now - prev >= windowMs) {
                allowed[0] = true;
                return now;
            }
            return prev;
        });
        return allowed[0];
    }
}
