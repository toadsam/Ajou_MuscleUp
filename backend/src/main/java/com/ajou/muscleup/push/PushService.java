package com.ajou.muscleup.push;

import com.ajou.muscleup.entity.PushLog;
import com.ajou.muscleup.entity.PushPreference;
import com.ajou.muscleup.entity.PushSubscription;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.PushLogRepository;
import com.ajou.muscleup.repository.PushPreferenceRepository;
import com.ajou.muscleup.repository.PushSubscriptionRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.server.ResponseStatusException;

/**
 * 웹 푸시 알림. 사용자 규칙(2026-10-13):
 * - **하루 2개까지**(시험 알림은 따로 하루 3번).
 * - **종류별로 끌 수 있다**: 저녁 출석 알림(REMINDER) · 주말 주간 목표(WEEKLY) · 응원 · 댓글(SOCIAL).
 * - **조용한 시간(밤 10시 ~ 아침 8시, 한국 시간)엔 보내지 않는다** — 그 사이 생긴 응원 알림은 버린다(쌓았다 아침에 몰아 보내지 않음).
 * 구독 주소는 알려진 푸시 서비스(FCM · Mozilla · Apple · Windows)만 받는다 — 서버가 아무 주소로나 요청을 보내지 않게.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {
    public enum Type { REMINDER, WEEKLY, SOCIAL, TEST }

    static final int DAILY_CAP = 2;
    static final int TEST_CAP = 3;
    static final int MAX_DEVICES = 5;
    static final LocalTime QUIET_FROM = LocalTime.of(22, 0);
    static final LocalTime QUIET_UNTIL = LocalTime.of(8, 0);
    static final List<String> ALLOWED_HOST_SUFFIXES = List.of(
            "fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com");

    private final PushSubscriptionRepository subscriptionRepository;
    private final PushPreferenceRepository preferenceRepository;
    private final PushLogRepository logRepository;
    private final UserRepository userRepository;
    private final PushSender sender;
    private final VapidKeys keys;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public record Config(boolean enabled, String publicKey) {}

    public record Preferences(boolean reminder, boolean weekly, boolean social) {}

    public record Me(boolean enabled, int devices, Preferences preferences, int sentToday, int dailyCap) {}

    public record Message(String title, String body, String url, String tag) {}

    /** 다른 서비스가 "이 사람에게 알려 줘"를 남길 때(커밋 뒤 따로 보낸다) */
    public record PushEvent(Long userId, Type type, Message message) {}

    public Config config() {
        return new Config(keys.enabled(), keys.publicKeyB64());
    }

    @Transactional(readOnly = true)
    public Me me(User me) {
        return new Me(keys.enabled(), (int) subscriptionRepository.countByUser_Id(me.getId()), preferences(me),
                (int) logRepository.countByUser_IdAndSentOnAndTypeNot(me.getId(), LocalDate.now(clock), Type.TEST.name()), DAILY_CAP);
    }

    @Transactional
    public Me subscribe(User me, String endpoint, String p256dh, String auth) {
        if (!keys.enabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "알림을 준비하고 있어요. 조금 뒤에 다시 켜 주세요.");
        }
        String ep = checkedEndpoint(endpoint);
        try {
            if (WebPushCrypto.unb64(p256dh).length != 65 || WebPushCrypto.unb64(auth).length != 16) throw new IllegalArgumentException();
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 구독 정보가 맞지 않아요.");
        }
        String hash = sha256(ep);
        PushSubscription sub = subscriptionRepository.findByEndpointHash(hash).orElse(null);
        if (sub == null) {
            if (subscriptionRepository.countByUser_Id(me.getId()) >= MAX_DEVICES) {
                // 가장 오래된 기기 하나를 빼고 받는다
                subscriptionRepository.findAllByUser_IdOrderByIdAsc(me.getId()).stream().findFirst().ifPresent(subscriptionRepository::delete);
            }
            sub = PushSubscription.builder().endpoint(ep).endpointHash(hash).build();
        }
        // 같은 기기에서 다른 계정으로 로그인해 켜면 그 계정으로 옮긴다
        sub.setUser(me);
        sub.setP256dh(p256dh.trim());
        sub.setAuth(auth.trim());
        subscriptionRepository.save(sub);
        if (preferenceRepository.findByUser_Id(me.getId()).isEmpty()) {
            preferenceRepository.save(PushPreference.builder().user(me).reminder(true).weekly(true).social(true).build());
        }
        return me(me);
    }

    @Transactional
    public Me unsubscribe(User me, String endpoint) {
        if (endpoint != null && !endpoint.isBlank()) {
            subscriptionRepository.findByEndpointHash(sha256(endpoint.trim()))
                    .filter(s -> s.getUser().getId().equals(me.getId()))
                    .ifPresent(subscriptionRepository::delete);
        }
        return me(me);
    }

    @Transactional
    public Me setPreferences(User me, Preferences p) {
        PushPreference pref = preferenceRepository.findByUser_Id(me.getId())
                .orElseGet(() -> PushPreference.builder().user(me).build());
        pref.setReminder(p.reminder());
        pref.setWeekly(p.weekly());
        pref.setSocial(p.social());
        preferenceRepository.save(pref);
        return me(me);
    }

    /**
     * 규칙을 지키며 보낸다 → 전한 기기 수(안 보냈으면 0).
     * 꺼 둔 종류 · 조용한 시간 · 하루 한도 · 구독 없음이면 보내지 않는다.
     */
    @Transactional
    public int send(Long userId, Type type, Message message) {
        if (!keys.enabled()) return 0;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return 0;
        LocalDateTime now = LocalDateTime.now(clock);
        if (type != Type.TEST) {
            if (!allowed(preferences(user), type) || quiet(now.toLocalTime())) return 0;
            if (logRepository.countByUser_IdAndSentOnAndTypeNot(userId, now.toLocalDate(), Type.TEST.name()) >= DAILY_CAP) return 0;
        } else if (logRepository.countByUser_IdAndSentOnAndType(userId, now.toLocalDate(), Type.TEST.name()) >= TEST_CAP) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "시험 알림은 하루 " + TEST_CAP + "번까지예요.");
        }
        List<PushSubscription> subs = subscriptionRepository.findAllByUser_IdOrderByIdAsc(userId);
        if (subs.isEmpty()) return 0;
        byte[] payload = payload(message);
        int delivered = 0;
        for (PushSubscription s : subs) {
            PushSender.Result r = sender.send(s.getEndpoint(), s.getP256dh(), s.getAuth(), payload);
            if (r == PushSender.Result.OK) {
                delivered++;
                s.setLastSuccessAt(now);
            } else if (r == PushSender.Result.GONE) {
                subscriptionRepository.delete(s);
            }
        }
        logRepository.save(PushLog.builder().user(user).sentOn(now.toLocalDate()).type(type.name()).sentAt(now).delivered(delivered).build());
        return delivered;
    }

    /** 응원 · 댓글처럼 요청 중에 생긴 알림 — 커밋된 뒤 따로(요청을 붙잡지 않게) */
    @Async
    @TransactionalEventListener(fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void on(PushEvent e) {
        try {
            send(e.userId(), e.type(), e.message());
        } catch (RuntimeException ex) {
            log.info("[push] 알림을 보내지 못함: {}", ex.getClass().getSimpleName());
        }
    }

    @Transactional(readOnly = true)
    public List<Long> subscribedUserIds() {
        return subscriptionRepository.findDistinctUserIds();
    }

    @Transactional
    public int cleanupLogs() {
        return logRepository.deleteBySentOnBefore(LocalDate.now(clock).minusDays(30));
    }

    static boolean quiet(LocalTime t) {
        return !t.isBefore(QUIET_FROM) || t.isBefore(QUIET_UNTIL);
    }

    private static boolean allowed(Preferences p, Type type) {
        return switch (type) {
            case REMINDER -> p.reminder();
            case WEEKLY -> p.weekly();
            case SOCIAL -> p.social();
            case TEST -> true;
        };
    }

    private Preferences preferences(User me) {
        return preferenceRepository.findByUser_Id(me.getId())
                .map(p -> new Preferences(p.isReminder(), p.isWeekly(), p.isSocial()))
                .orElse(new Preferences(true, true, true));
    }

    private byte[] payload(Message m) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("title", m.title());
        data.put("body", m.body());
        data.put("url", m.url() != null && m.url().startsWith("/") ? m.url() : "/");
        if (m.tag() != null) data.put("tag", m.tag());
        try {
            return objectMapper.writeValueAsString(data).getBytes(StandardCharsets.UTF_8);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    static String checkedEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank() || endpoint.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 구독 정보가 맞지 않아요.");
        }
        String ep = endpoint.trim();
        try {
            URI uri = URI.create(ep);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
            boolean known = ALLOWED_HOST_SUFFIXES.stream().anyMatch(s -> host.equals(s) || host.endsWith("." + s));
            if (!"https".equals(uri.getScheme()) || !known) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 브라우저의 알림 서비스는 아직 지원하지 않아요.");
        }
        return ep;
    }

    static String sha256(String v) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
