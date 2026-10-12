package com.ajou.muscleup.push;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 푸시 서비스(FCM · Mozilla · Apple)에 암호화한 알림 하나를 보낸다. 테스트는 이 빈을 기록만 하는 것으로 바꿔 끼운다.
 * 결과: OK(201 등) · GONE(404 · 410 — 구독이 없어짐, 지운다) · FAILED(그 밖 — 다음에 다시).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushSender {
    public enum Result { OK, GONE, FAILED }

    /** 하루 안에 못 전하면 버린다(휴대폰이 꺼져 있던 경우) */
    static final int TTL_SECONDS = 12 * 3600;

    private final VapidKeys keys;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public Result send(String endpoint, String p256dh, String auth, byte[] payload) {
        if (!keys.enabled()) return Result.FAILED;
        try {
            URI uri = URI.create(endpoint);
            String audience = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
            long exp = System.currentTimeMillis() / 1000 + 12 * 3600;
            String jwt = WebPushCrypto.vapidJwt(audience, keys.subject(), exp, keys.privateKey());
            byte[] body = WebPushCrypto.encrypt(payload, WebPushCrypto.unb64(p256dh), WebPushCrypto.unb64(auth));
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(10))
                    .header("TTL", String.valueOf(TTL_SECONDS))
                    .header("Urgency", "normal")
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("Authorization", "vapid t=" + jwt + ", k=" + keys.publicKeyB64())
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            int status = http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status >= 200 && status < 300) return Result.OK;
            if (status == 404 || status == 410) return Result.GONE;
            log.info("[push] 푸시 서비스 응답 {} ({})", status, uri.getHost());
            return Result.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.FAILED;
        } catch (Exception e) {
            log.info("[push] 보내지 못함: {}", e.getClass().getSimpleName());
            return Result.FAILED;
        }
    }
}
