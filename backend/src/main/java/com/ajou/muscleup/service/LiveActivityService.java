package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.GrowthParamsResponse;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * "지금 운동 · 러닝 중" — 운동 세션 · 러닝 화면이 1분마다 알려 주면(PUT /api/live) 3분 동안 기억한다.
 * 라운지 광장의 운동 구역에 그 사람들의 캐릭터가 지금 종목 동작을 하는 모습으로 보인다.
 *
 * 서버 메모리에만 둔다(DB 에 쓰지 않음, 재시작하면 비어도 1분 안에 다시 찬다). 백엔드가 여러 대가 되면 공유 저장소가 필요하다.
 * 다른 사람에게는 닉네임 · 캐릭터 겉모습 · 종목 이름만 보낸다(이메일 · 사용자 번호 · 무게는 보내지 않음).
 */
@Service
@RequiredArgsConstructor
public class LiveActivityService {
    public static final Duration TTL = Duration.ofMinutes(3);
    public static final int MAX_LIST = 12;
    private static final Duration LIST_CACHE = Duration.ofSeconds(10);

    public enum Activity { WORKOUT, RUN }

    public record LiveRequest(String activity, String exercise) {}

    /** 다른 사람에게 보이는 한 줄 */
    public record LiveView(String nickname, boolean mine, String activity, String exercise, String label, String category,
                           boolean bodyweight, String avatarSeed, CharacterTier tier, int evolutionStage, Gender gender,
                           GrowthParamsResponse growthParams, String tank, boolean isPumped, long since, int bodyStage) {}

    private record Entry(Long userId, Activity activity, ExerciseCatalog.ExerciseDef exercise, Instant since, Instant seen) {}

    /** 캐시에는 "내 것" 표시를 위해 사용자 번호를 같이 들고 있다(응답에는 싣지 않는다) */
    private record Row(Long userId, LiveView view) {}

    private final Map<Long, Entry> live = new ConcurrentHashMap<>();
    private volatile List<Row> cached = List.of();
    private volatile Instant cachedAt = Instant.EPOCH;

    private final ExerciseCatalog catalog;
    private final UserRepository userRepository;
    private final CharacterProfileRepository profileRepository;
    private final UserBodyStatsRepository statsRepository;
    private final CharacterGrowthCalculator growthCalculator;
    private final AvatarLookService avatarLookService;
    private final Clock clock;

    /** 운동 중이라고 알린다(같은 사람이 다시 알리면 종목 · 마지막 시각만 바뀐다) */
    @Transactional(readOnly = true)
    public void beat(User me, LiveRequest req) {
        Activity activity;
        try {
            activity = Activity.valueOf(req == null || req.activity() == null ? "" : req.activity().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "활동을 확인해 주세요.");
        }
        ExerciseCatalog.ExerciseDef ex = null;
        if (activity == Activity.WORKOUT && req.exercise() != null && !req.exercise().isBlank()) {
            ex = catalog.resolve(me, req.exercise(), false); // 남의 종목 · 모르는 코드는 null → 종목 없이 "운동 중"
        }
        Instant now = clock.instant();
        Entry prev = live.get(me.getId());
        Instant since = prev != null && prev.activity() == activity ? prev.since() : now;
        live.put(me.getId(), new Entry(me.getId(), activity, ex, since, now));
        cachedAt = Instant.EPOCH;
    }

    public void end(User me) {
        if (live.remove(me.getId()) != null) cachedAt = Instant.EPOCH;
    }

    /** 지금 운동 · 러닝 중인 사람(최근에 시작한 순, 최대 12명). 10초 동안은 같은 목록을 돌려준다 */
    @Transactional(readOnly = true)
    public List<LiveView> list(User me) {
        Instant now = clock.instant();
        live.values().removeIf(e -> e.seen().plus(TTL).isBefore(now));
        if (cachedAt.plus(LIST_CACHE).isBefore(now)) {
            cached = build();
            cachedAt = now;
        }
        return cached.stream().map(r -> r.userId().equals(me.getId()) ? withMine(r.view()) : r.view()).toList();
    }

    public int count() {
        Instant now = clock.instant();
        return (int) live.values().stream().filter(e -> !e.seen().plus(TTL).isBefore(now)).count();
    }

    private static LiveView withMine(LiveView v) {
        return new LiveView(v.nickname(), true, v.activity(), v.exercise(), v.label(), v.category(), v.bodyweight(), v.avatarSeed(),
                v.tier(), v.evolutionStage(), v.gender(), v.growthParams(), v.tank(), v.isPumped(), v.since(), v.bodyStage());
    }

    private List<Row> build() {
        List<Entry> entries = live.values().stream()
                .sorted(Comparator.comparing(Entry::since).reversed())
                .limit(MAX_LIST)
                .toList();
        if (entries.isEmpty()) return List.of();
        List<Long> ids = entries.stream().map(Entry::userId).toList();
        Map<Long, User> users = userRepository.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        List<User> list = ids.stream().map(users::get).filter(u -> u != null).toList();
        Map<Long, CharacterProfile> profiles = profileRepository.findAllByUserIn(list).stream()
                .collect(Collectors.toMap(p -> p.getUser().getId(), Function.identity(), (a, b) -> a));
        Map<Long, UserBodyStats> stats = statsRepository.findAllByUserIn(list).stream()
                .collect(Collectors.toMap(s -> s.getUser().getId(), Function.identity(), (a, b) -> a));
        Map<Long, AvatarLookService.Look> looks = avatarLookService.looks(ids);
        long nowMs = clock.millis();
        return entries.stream().filter(e -> users.containsKey(e.userId()) && profiles.containsKey(e.userId())).map(e -> {
            User u = users.get(e.userId());
            CharacterProfile p = profiles.get(e.userId());
            AvatarLookService.Look look = looks.get(e.userId());
            ExerciseCatalog.ExerciseDef ex = e.exercise();
            String nick = u.getNickname() == null || u.getNickname().isBlank() ? "회원" : u.getNickname();
            LiveView v = new LiveView(nick, false, e.activity().name(),
                    ex == null ? null : ex.code(), ex == null ? null : ex.label(), ex == null ? null : ex.category(),
                    ex != null && ex.bodyweight(), p.getAvatarSeed(), p.getTier(), p.getEvolutionStage(), p.getGender(),
                    growthCalculator.calculate(stats.get(e.userId())), look == null ? null : look.tank(),
                    look != null && look.pumped(nowMs), e.since().toEpochMilli(), look == null ? 0 : look.bodyStage());
            return new Row(e.userId(), v);
        }).toList();
    }
}
