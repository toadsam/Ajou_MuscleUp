package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.CharacterService;
import com.ajou.muscleup.service.FriendService;
import com.ajou.muscleup.service.GymScope;
import com.ajou.muscleup.util.RoleUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 실시간 서버(realtime/)에 들어갈 때 쓰는 짧은 입장권(ticket)을 발급한다.
 *
 * 형식: base64url(JSON 본문) + "." + base64url(HMAC-SHA256(본문, REALTIME_TICKET_SECRET))
 * 실시간 서버는 같은 비밀값으로 서명을 확인하고, 이름·레벨·티어·아바타·친구 목록을
 * 클라이언트가 보낸 값이 아니라 이 입장권에서 꺼내 쓴다. 이메일은 입장권에 넣지 않는다.
 *
 * 비밀값: 환경변수 REALTIME_TICKET_SECRET (또는 프로퍼티 realtime.ticket.secret), 32자 이상.
 * 실시간 서버에도 같은 값을 넣어야 한다. prod 프로필에서 비어 있으면 503 을 돌려준다.
 * 그 밖의 프로필(local/test)에서 비어 있으면 개발용 고정값을 쓰고 경고를 남긴다
 * (realtime/src/auth.ts 의 개발용 값과 같아야 한다).
 *
 * 라운지 방(0단계 PR 7): 본문 { "room": "square" | "gym:{slug}" }. 없으면 광장.
 * 모임 방은 그 모임 멤버(앱 운영자 포함)만, 모임이 운영 중이고 라운지 기능이 켜져 있을 때만.
 * 입장권에는 "room": "square" | "gym:{id}" 와 방 이름 "rname" 이 들어가고, 실시간 서버는 이 값으로만 방을 나눈다.
 */
@Slf4j
@RestController
@RequestMapping("/api/realtime")
public class RealtimeTicketController {
    static final String DEV_SECRET = "muscleup-dev-only-realtime-ticket-secret";
    private static final long TTL_SECONDS = 120;
    private static final int MAX_FRIEND_IDS = 500;

    private final UserRepository userRepository;
    private final CharacterService characterService;
    private final FriendService friendService;
    private final ObjectMapper objectMapper;
    private final GymScope gymScope;
    private final byte[] secret;

    /** 들어갈 라운지 방. 비우면 광장 */
    public record TicketRequest(String room) {}

    public RealtimeTicketController(
            UserRepository userRepository,
            CharacterService characterService,
            FriendService friendService,
            ObjectMapper objectMapper,
            GymScope gymScope,
            Environment environment,
            @Value("${realtime.ticket.secret:}") String configuredSecret
    ) {
        this.userRepository = userRepository;
        this.characterService = characterService;
        this.friendService = friendService;
        this.objectMapper = objectMapper;
        this.gymScope = gymScope;

        String value = configuredSecret == null ? "" : configuredSecret.trim();
        boolean prod = environment.acceptsProfiles(Profiles.of("prod"));
        if (value.length() >= 32) {
            this.secret = value.getBytes(StandardCharsets.UTF_8);
        } else if (prod) {
            log.error("[realtime-ticket] REALTIME_TICKET_SECRET is missing or shorter than 32 chars. Lounge/friend realtime is disabled.");
            this.secret = null;
        } else {
            log.warn("[realtime-ticket] REALTIME_TICKET_SECRET not set. Using the development-only secret (never use this in production).");
            this.secret = DEV_SECRET.getBytes(StandardCharsets.UTF_8);
        }
    }

    @PostMapping("/ticket")
    public ResponseEntity<Map<String, Object>> issue(@AuthenticationPrincipal String email,
                                                     @RequestBody(required = false) TicketRequest request) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        if (secret == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "실시간 기능을 지금은 쓸 수 없어요.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
        WorkoutCrew roomGym = resolveRoomGym(request == null ? null : request.room(), user);
        CharacterProfileResponse character = characterService.getOrCreateProfile(email);
        List<Long> friendIds = friendService.findFriendIds(user.getId());
        if (friendIds.size() > MAX_FRIEND_IDS) {
            friendIds = friendIds.subList(0, MAX_FRIEND_IDS);
        }

        long now = Instant.now().getEpochSecond();
        long exp = now + TTL_SECONDS;
        String nickname = user.getNickname() == null ? "" : user.getNickname().trim();
        if (nickname.isEmpty()) nickname = "회원";
        if (nickname.length() > 30) nickname = nickname.substring(0, 30);

        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("v", 1);
        claims.put("uid", user.getId());
        claims.put("pid", publicId(user.getId()));
        claims.put("nick", nickname);
        claims.put("lv", character.getLevel());
        claims.put("tier", character.getTier() == null ? "BRONZE" : character.getTier().name());
        claims.put("stage", character.getEvolutionStage());
        claims.put("gender", character.getGender() == null ? null : character.getGender().name());
        claims.put("seed", character.getAvatarSeed());
        claims.put("style", character.getStylePreset());
        claims.put("rest", character.isResting());
        claims.put("gp", character.getGrowthParams());
        claims.put("fr", friendIds);
        claims.put("room", roomGym == null ? "square" : "gym:" + roomGym.getId());
        claims.put("rname", roomGym == null ? "광장" : truncate(roomGym.getName(), 40));
        claims.put("iat", now);
        claims.put("exp", exp);

        String body;
        try {
            body = b64(objectMapper.writeValueAsBytes(claims));
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "입장권을 만들지 못했어요.");
        }
        String ticket = body + "." + b64(hmac(body.getBytes(StandardCharsets.US_ASCII)));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ticket", ticket);
        response.put("expiresAt", exp * 1000);
        response.put("room", claims.get("room"));
        response.put("roomName", claims.get("rname"));
        return ResponseEntity.ok(response);
    }

    /** "gym:{slug}" → 들어갈 수 있는 모임. 광장이면 null */
    private WorkoutCrew resolveRoomGym(String room, User user) {
        if (room == null || room.isBlank() || "square".equals(room.trim())) return null;
        String value = room.trim();
        if (!value.startsWith("gym:")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 라운지 방이에요.");
        }
        WorkoutCrew gym = gymScope.gymOrThrow(value.substring(4));
        boolean admin = RoleUtils.isAdmin(user);
        if (!admin && !gymScope.isMember(gym, user)) {
            if (!gymScope.canSee(gym, user)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요.");
            }
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "그 모임 멤버만 모임 라운지에 들어갈 수 있어요.");
        }
        if (gym.statusOrDefault() != GymStatus.ACTIVE || !gym.getFeatures().contains(GymFeature.LOUNGE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 모임은 라운지를 쓰지 않아요.");
        }
        return gym;
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** 라운지에서 다른 사람에게 보이는 id. 이메일·DB id 를 거꾸로 알아낼 수 없게 HMAC 으로 만든다. */
    private String publicId(Long userId) {
        byte[] mac = hmac(("pid:" + userId).getBytes(StandardCharsets.UTF_8));
        return "p" + HexFormat.of().formatHex(mac).substring(0, 16);
    }

    private byte[] hmac(byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    private static String b64(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }
}
