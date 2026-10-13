package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.CustomExercise;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.CustomExerciseRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 종목 찾기: 기본 31개(LiftExercise) + 내가 직접 추가한 종목(CustomExercise, 코드 "C"+id).
 * 운동 기록 · 운동 세션은 종목을 코드 문자열로 저장하므로, 직접 추가한 종목도 개인 최고 · 지난번 값 · 그래프가 그대로 된다(3대는 아님).
 * 최근 한 종목(고르기 화면 맨 위 "최근")도 여기서.
 */
@Service
@RequiredArgsConstructor
public class ExerciseCatalog {
    public static final String CUSTOM_PREFIX = "C";
    static final int MAX_CUSTOM = 50;
    static final int MAX_NAME = 30;
    static final int RECENT_LIMIT = 8;
    static final Set<String> CATEGORIES = Set.of("LEGS", "CHEST", "BACK", "SHOULDERS", "ARMS", "CORE", "OTHER");

    private final CustomExerciseRepository customRepository;
    private final EntityManager em;

    /** 종목 하나. custom 이면 내가 추가한 것 */
    public record ExerciseDef(String code, String label, String category, boolean bigThree, boolean bodyweight, boolean custom) {
        static ExerciseDef of(LiftExercise e) {
            return new ExerciseDef(e.name(), e.label, e.category.name(), e.bigThree, e.bodyweight, false);
        }

        static ExerciseDef of(CustomExercise c) {
            return new ExerciseDef(CUSTOM_PREFIX + c.getId(), c.getName(), c.getCategory(), false, c.isBodyweight(), true);
        }
    }

    public record CustomRequest(String name, String category, Boolean bodyweight) {}

    /** 기본 종목 또는 내 종목(지운 것은 allowDeleted 일 때만) — 모르면 null */
    @Transactional(readOnly = true)
    public ExerciseDef resolve(User me, String code, boolean allowDeleted) {
        if (code == null || code.isBlank()) return null;
        LiftExercise built = LiftExercise.parse(code);
        if (built != null) return ExerciseDef.of(built);
        Long id = customId(code);
        if (id == null) return null;
        return customRepository.findByIdAndUser_Id(id, me.getId())
                .filter(c -> allowDeleted || !c.isDeleted())
                .map(ExerciseDef::of)
                .orElse(null);
    }

    /** 화면에 보일 이름들(지운 내 종목도 이름은 그대로) — 코드 → 종목 */
    @Transactional(readOnly = true)
    public Map<String, ExerciseDef> describe(Collection<String> codes) {
        Map<String, ExerciseDef> out = new HashMap<>();
        List<Long> ids = new ArrayList<>();
        for (String code : codes) {
            LiftExercise built = LiftExercise.parse(code);
            if (built != null) {
                out.put(code, ExerciseDef.of(built));
            } else {
                Long id = customId(code);
                if (id != null) ids.add(id);
            }
        }
        if (!ids.isEmpty()) {
            customRepository.findAllById(ids).forEach(c -> out.put(CUSTOM_PREFIX + c.getId(), ExerciseDef.of(c)));
        }
        return out;
    }

    public static String label(Map<String, ExerciseDef> defs, String code) {
        ExerciseDef d = defs.get(code);
        return d == null ? code : d.label();
    }

    @Transactional(readOnly = true)
    public List<ExerciseDef> customs(User me) {
        return customRepository.findAllByUser_IdAndDeletedFalseOrderByIdAsc(me.getId()).stream().map(ExerciseDef::of).toList();
    }

    @Transactional
    public ExerciseDef create(User me, CustomRequest req) {
        String name = cleanName(req == null ? null : req.name());
        String category = req == null || req.category() == null ? "OTHER" : req.category().trim().toUpperCase(Locale.ROOT);
        if (!CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "부위를 골라 주세요.");
        }
        if (customRepository.countByUser_IdAndDeletedFalse(me.getId()) >= MAX_CUSTOM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "직접 추가한 종목은 " + MAX_CUSTOM + "개까지예요. 안 쓰는 걸 지워 주세요.");
        }
        String key = key(name);
        boolean taken = LiftExercise.all().stream().anyMatch(e -> key(e.label()).equals(key))
                || customRepository.findAllByUser_IdAndDeletedFalseOrderByIdAsc(me.getId()).stream().anyMatch(c -> key(c.getName()).equals(key));
        if (taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 있는 종목이에요. 목록에서 찾아 주세요.");
        }
        CustomExercise saved = customRepository.save(CustomExercise.builder().user(me).name(name).category(category)
                .bodyweight(req != null && Boolean.TRUE.equals(req.bodyweight())).build());
        return ExerciseDef.of(saved);
    }

    @Transactional
    public void delete(User me, String code) {
        Long id = customId(code);
        CustomExercise c = id == null ? null : customRepository.findByIdAndUser_Id(id, me.getId()).orElse(null);
        if (c == null || c.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "종목을 찾을 수 없어요.");
        }
        c.setDeleted(true); // 지난 기록의 이름은 남긴다
    }

    /**
     * 내 종목 이름 · 부위 고치기. 지난 기록도 같은 코드를 쓰므로 새 이름으로 보인다.
     * 맨몸 여부는 바꾸지 않는다(지난 기록의 무게 0 세트가 맞지 않게 될 수 있어서).
     */
    @Transactional
    public ExerciseDef update(User me, String code, CustomRequest req) {
        Long id = customId(code);
        CustomExercise c = id == null ? null : customRepository.findByIdAndUser_Id(id, me.getId()).orElse(null);
        if (c == null || c.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "종목을 찾을 수 없어요.");
        }
        String name = cleanName(req == null ? null : req.name());
        String category = req == null || req.category() == null ? c.getCategory() : req.category().trim().toUpperCase(Locale.ROOT);
        if (!CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "부위를 골라 주세요.");
        }
        String key = key(name);
        boolean taken = LiftExercise.all().stream().anyMatch(e -> key(e.label()).equals(key))
                || customRepository.findAllByUser_IdAndDeletedFalseOrderByIdAsc(me.getId()).stream()
                .anyMatch(o -> !o.getId().equals(c.getId()) && key(o.getName()).equals(key));
        if (taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 있는 종목 이름이에요.");
        }
        c.setName(name);
        c.setCategory(category);
        return ExerciseDef.of(c);
    }

    /** 최근에 한 종목(세션 세트 · 빠른 기록에서), 새것부터 8개. 지운 내 종목은 뺀다 */
    @Transactional(readOnly = true)
    public List<ExerciseDef> recent(User me) {
        Map<String, LocalDateTime> last = new LinkedHashMap<>();
        List<Object[]> fromSets = em.createQuery(
                        "select x.exercise, max(s.startedAt) from WorkoutSet x join x.session s where s.user.id = :id "
                                + "group by x.exercise order by max(s.startedAt) desc", Object[].class)
                .setParameter("id", me.getId()).setMaxResults(30).getResultList();
        for (Object[] r : fromSets) last.merge((String) r[0], (LocalDateTime) r[1], (a, b) -> a.isAfter(b) ? a : b);
        List<Object[]> fromLifts = em.createQuery(
                        "select l.exercise, max(l.performedOn) from LiftEntry l where l.user.id = :id "
                                + "group by l.exercise order by max(l.performedOn) desc", Object[].class)
                .setParameter("id", me.getId()).setMaxResults(30).getResultList();
        for (Object[] r : fromLifts) {
            LocalDateTime at = ((LocalDate) r[1]).atStartOfDay();
            last.merge((String) r[0], at, (a, b) -> a.isAfter(b) ? a : b);
        }
        List<String> codes = last.entrySet().stream().sorted(Map.Entry.<String, LocalDateTime>comparingByValue().reversed())
                .map(Map.Entry::getKey).toList();
        Map<String, ExerciseDef> defs = describe(codes);
        Set<String> deleted = new java.util.HashSet<>();
        for (String code : codes) {
            ExerciseDef d = defs.get(code);
            if (d != null && d.custom() && resolve(me, code, false) == null) deleted.add(code);
        }
        return codes.stream().map(defs::get).filter(d -> d != null && !deleted.contains(d.code())).limit(RECENT_LIMIT).toList();
    }

    static Long customId(String code) {
        String c = code.trim();
        if (c.length() < 2 || !c.substring(0, 1).equalsIgnoreCase(CUSTOM_PREFIX)) return null;
        try {
            return Long.parseLong(c.substring(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String cleanName(String name) {
        String n = name == null ? "" : name.strip().replaceAll("\\s+", " ");
        if (n.isEmpty() || n.length() > MAX_NAME) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종목 이름은 1~" + MAX_NAME + "자로 적어 주세요.");
        }
        return n;
    }

    private static String key(String name) {
        return name.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
}
