package com.ajou.muscleup.security;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 메모리 안에서 도는 고정 창(fixed window) 요청 제한기.
 *
 * - 키 하나(예: "ai:min:user@x.com")마다 "창 시작 시각 + 횟수"만 들고 있다.
 * - 서버가 여러 대면 대수만큼 한도가 늘어난다(단일 인스턴스 기준 보호). 다중 인스턴스로 가면 Redis 로 옮긴다.
 * - 오래된 키는 5분마다 정리한다.
 */
@Component
public class RateLimiter {

    private static final class Window {
        final long startedAt;
        final long windowMs;
        int count;

        Window(long startedAt, long windowMs) {
            this.startedAt = startedAt;
            this.windowMs = windowMs;
        }

        boolean expired(long now) {
            return now - startedAt >= windowMs;
        }
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    /** 한 번 쓰고, 한도를 넘었으면 false. */
    public boolean tryAcquire(String key, int limit, Duration window) {
        long now = System.currentTimeMillis();
        long windowMs = window.toMillis();
        boolean[] allowed = {false};
        windows.compute(key, (k, w) -> {
            if (w == null || w.expired(now)) {
                w = new Window(now, windowMs);
            }
            if (w.count < limit) {
                w.count++;
                allowed[0] = true;
            }
            return w;
        });
        return allowed[0];
    }

    /** 한 번 쓰고, 한도를 넘었으면 429 를 던진다. */
    public void check(String key, int limit, Duration window, String message) {
        if (!tryAcquire(key, limit, window)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
        }
    }

    /** 세지 않고 지금 막혀 있는지만 본다(로그인 실패 횟수처럼 "실패할 때만 센다"에 쓴다). */
    public boolean isBlocked(String key, int limit) {
        Window w = windows.get(key);
        return w != null && !w.expired(System.currentTimeMillis()) && w.count >= limit;
    }

    /** 실패 1회를 기록한다. */
    public void recordFailure(String key, Duration window) {
        long now = System.currentTimeMillis();
        long windowMs = window.toMillis();
        windows.compute(key, (k, w) -> {
            if (w == null || w.expired(now)) {
                w = new Window(now, windowMs);
            }
            w.count++;
            return w;
        });
    }

    public void reset(String key) {
        windows.remove(key);
    }

    @Scheduled(fixedDelay = 300_000L)
    public void evictExpired() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> e.getValue().expired(now));
    }
}
