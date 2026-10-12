package com.ajou.muscleup.push;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.PushSubscriptionRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.scheduler.PushScheduler;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 웹 푸시. 지금을 2026-10-17(토) 18:30 KST 로 고정, 실제로 보내지 않고 보낸 것만 기록한다 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PushTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 17);

    static class RecordingSender extends PushSender {
        final List<String> endpoints = new ArrayList<>();
        final List<String> payloads = new ArrayList<>();
        final Deque<Result> next = new ArrayDeque<>();

        RecordingSender(VapidKeys keys) {
            super(keys);
        }

        @Override
        public Result send(String endpoint, String p256dh, String auth, byte[] payload) {
            endpoints.add(endpoint);
            payloads.add(new String(payload, StandardCharsets.UTF_8));
            Result r = next.poll();
            return r == null ? Result.OK : r;
        }
    }

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(TODAY.atTime(18, 30).atZone(TimeConfig.KST).toInstant(), TimeConfig.KST);
        }

        @Bean
        @Primary
        RecordingSender recordingSender(VapidKeys keys) {
            return new RecordingSender(keys);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PushSubscriptionRepository subscriptions;
    @Autowired PushService pushService;
    @Autowired PushScheduler scheduler;
    @Autowired RecordingSender sender;

    private User alice;
    private User bob;
    private String p256dh;
    private String auth;

    @BeforeEach
    void setUp() {
        sender.endpoints.clear();
        sender.payloads.clear();
        sender.next.clear();
        alice = save("push-alice@test.local");
        bob = save("push-bob@test.local");
        p256dh = WebPushCrypto.b64(WebPushCrypto.encodePublic((ECPublicKey) WebPushCrypto.generateKeyPair().getPublic()));
        auth = WebPushCrypto.b64(WebPushCrypto.randomBytes(16));
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 10)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions subscribe(User u, String endpoint, String key, String secret) throws Exception {
        return mvc.perform(post("/api/push/subscribe").with(as(u)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"" + endpoint + "\",\"keys\":{\"p256dh\":\"" + key + "\",\"auth\":\"" + secret + "\"}}"));
    }

    @Test
    void subscribeTestCapPreferencesAndGone() throws Exception {
        mvc.perform(get("/api/push/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.publicKey").isString());
        // 알려진 푸시 서비스만 · 키 형식 확인
        subscribe(alice, "https://evil.example.com/hook", p256dh, auth).andExpect(status().isBadRequest());
        subscribe(alice, "http://fcm.googleapis.com/fcm/send/a", p256dh, auth).andExpect(status().isBadRequest());
        subscribe(alice, "https://fcm.googleapis.com/fcm/send/a", "abc", auth).andExpect(status().isBadRequest());
        subscribe(alice, "https://fcm.googleapis.com/fcm/send/a", p256dh, auth)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devices").value(1))
                .andExpect(jsonPath("$.preferences.social").value(true));
        // 같은 기기를 다시 구독해도 하나
        subscribe(alice, "https://fcm.googleapis.com/fcm/send/a", p256dh, auth).andExpect(jsonPath("$.devices").value(1));
        subscribe(alice, "https://updates.push.services.mozilla.com/wpush/v2/b", p256dh, auth).andExpect(jsonPath("$.devices").value(2));

        // 시험 알림: 두 기기에, 하루 3번까지(하루 2개 한도와 따로)
        mvc.perform(post("/api/push/test").with(as(alice))).andExpect(jsonPath("$.delivered").value(2));
        assertThat(sender.payloads.get(0)).contains("\"title\":\"득근득근 알림\"").contains("\"url\":\"/\"");
        mvc.perform(post("/api/push/test").with(as(alice))).andExpect(status().isOk());
        mvc.perform(post("/api/push/test").with(as(alice))).andExpect(status().isOk());
        mvc.perform(post("/api/push/test").with(as(alice))).andExpect(status().isTooManyRequests());

        // 하루 2개: 응원 두 번까지, 세 번째는 안 보냄. 바깥 주소(url)는 "/" 로
        PushService.Message cheer = new PushService.Message("응원을 받았어요", "누군가 응원했어요", "https://evil.example.com", "cheer");
        assertThat(pushService.send(alice.getId(), PushService.Type.SOCIAL, cheer)).isEqualTo(2);
        assertThat(sender.payloads.get(sender.payloads.size() - 1)).contains("\"url\":\"/\"");
        assertThat(pushService.send(alice.getId(), PushService.Type.SOCIAL, cheer)).isEqualTo(2);
        assertThat(pushService.send(alice.getId(), PushService.Type.SOCIAL, cheer)).isZero();
        mvc.perform(get("/api/push/me").with(as(alice))).andExpect(jsonPath("$.sentToday").value(2));

        // 종류별 끄기 + 사라진 구독(410)은 지운다
        subscribe(bob, "https://fcm.googleapis.com/fcm/send/bob", p256dh, auth).andExpect(status().isOk());
        mvc.perform(put("/api/push/preferences").with(as(bob)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reminder\":true,\"weekly\":true,\"social\":false}")).andExpect(jsonPath("$.preferences.social").value(false));
        assertThat(pushService.send(bob.getId(), PushService.Type.SOCIAL, cheer)).isZero();
        sender.next.add(PushSender.Result.GONE);
        assertThat(pushService.send(bob.getId(), PushService.Type.WEEKLY, cheer)).isZero();
        assertThat(subscriptions.countByUser_Id(bob.getId())).isZero();

        // 끄기: 내 기기만
        mvc.perform(post("/api/push/unsubscribe").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/a\"}")).andExpect(jsonPath("$.devices").value(1));
        mvc.perform(get("/api/push/me")).andExpect(status().is4xxClientError());
    }

    @Test
    void schedulerRemindsOnlyThoseWhoHaveNotAttended() throws Exception {
        subscribe(alice, "https://fcm.googleapis.com/fcm/send/a", p256dh, auth).andExpect(status().isOk());
        subscribe(bob, "https://fcm.googleapis.com/fcm/send/b", p256dh, auth).andExpect(status().isOk());
        // 밥은 오늘 출석함
        mvc.perform(post("/api/attendance/today").with(as(bob)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"didWorkout\":true,\"workoutTypes\":[\"weight\"]}")).andExpect(status().isOk());
        sender.endpoints.clear();
        sender.payloads.clear();
        assertThat(scheduler.remindOne(alice.getId())).isTrue();
        assertThat(scheduler.remindOne(bob.getId())).isFalse();
        assertThat(sender.endpoints).containsExactly("https://fcm.googleapis.com/fcm/send/a");
        assertThat(sender.payloads.get(0)).contains("이번 주 목표까지 3번");
        // 토요일: 주 3번 목표, 0번 했고 남은 날 2일 → 못 채우니 주간 알림은 보내지 않는다
        assertThat(scheduler.weeklyOne(alice.getId())).isFalse();
        // 주 2번으로 낮추면 보낸다(오늘 · 내일 하면 됨)
        mvc.perform(put("/api/attendance/weekly-goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"target\":2}"))
                .andExpect(status().isOk());
        assertThat(scheduler.weeklyOne(alice.getId())).isTrue();
        assertThat(sender.payloads.get(sender.payloads.size() - 1)).contains("이번 주 목표까지 2번 남았어요");
    }

    @Test
    void quietHours() {
        assertThat(PushService.quiet(LocalTime.of(22, 0))).isTrue();
        assertThat(PushService.quiet(LocalTime.of(3, 0))).isTrue();
        assertThat(PushService.quiet(LocalTime.of(7, 59))).isTrue();
        assertThat(PushService.quiet(LocalTime.of(8, 0))).isFalse();
        assertThat(PushService.quiet(LocalTime.of(21, 59))).isFalse();
    }

    @Test
    void encryptionRoundTripAndVapidJwt() throws Exception {
        KeyPair ua = WebPushCrypto.generateKeyPair();
        byte[] uaPublic = WebPushCrypto.encodePublic((ECPublicKey) ua.getPublic());
        byte[] secret = WebPushCrypto.randomBytes(16);
        byte[] msg = "{\"title\":\"안녕\"}".getBytes(StandardCharsets.UTF_8);
        byte[] body = WebPushCrypto.encrypt(msg, uaPublic, secret);
        assertThat(body.length).isEqualTo(16 + 4 + 1 + 65 + msg.length + 1 + 16);
        assertThat(WebPushCrypto.decrypt(body, (ECPrivateKey) ua.getPrivate(), uaPublic, secret)).isEqualTo(msg);

        // 키를 글자로 바꿨다 되돌려도 같다
        ECPrivateKey priv = WebPushCrypto.decodePrivate(WebPushCrypto.encodePrivate((ECPrivateKey) ua.getPrivate()));
        assertThat(priv.getS()).isEqualTo(((ECPrivateKey) ua.getPrivate()).getS());

        // JWT 서명은 공개 키로 확인된다(R||S → DER 로 되돌려 JDK 로 검증)
        String jwt = WebPushCrypto.vapidJwt("https://fcm.googleapis.com", "https://musclehub.co.kr", 2_000_000_000L, priv);
        String[] parts = jwt.split("\\.");
        assertThat(parts).hasSize(3);
        assertThat(new String(WebPushCrypto.unb64(parts[1]), StandardCharsets.UTF_8)).contains("\"aud\":\"https://fcm.googleapis.com\"");
        byte[] raw = WebPushCrypto.unb64(parts[2]);
        assertThat(raw).hasSize(64);
        java.security.Signature v = java.security.Signature.getInstance("SHA256withECDSAinP1363Format");
        v.initVerify(ua.getPublic());
        v.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(v.verify(raw)).isTrue();
    }

    /** RFC 8291 5절의 예시 값으로 같은 결과가 나오는지 */
    @Test
    void rfc8291Example() throws Exception {
        byte[] plaintext = WebPushCrypto.unb64("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24");
        byte[] asPublic = WebPushCrypto.unb64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        byte[] asPrivate = WebPushCrypto.unb64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        byte[] uaPublic = WebPushCrypto.unb64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] authSecret = WebPushCrypto.unb64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] salt = WebPushCrypto.unb64("DGv6ra1nlYgDCS1FRnbzlw");
        KeyPair as = new KeyPair(WebPushCrypto.decodePublic(asPublic), WebPushCrypto.decodePrivate(asPrivate));
        byte[] body = WebPushCrypto.encrypt(plaintext, uaPublic, authSecret, as, salt);
        assertThat(WebPushCrypto.b64(body)).isEqualTo("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIg"
                + "Dll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
    }
}
