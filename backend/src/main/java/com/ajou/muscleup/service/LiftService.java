package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.character.StatsCharacterResponse;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;
import com.ajou.muscleup.entity.LiftEntry;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.LiftEntryRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 운동 기록 + 개인 최고(PR). 개인 최고는 추정 1RM(Epley: 무게 × (1 + 횟수/30), 1회면 무게)으로 비교한다.
 * - 개인 최고를 깨면 활동 점수 +5(종목마다 하루 한 번, 하루 3종목까지).
 * - 3대(스쿼트 · 벤치 · 데드)는 5회 이하로 든 기록의 추정 1RM 이 마이페이지 3대 기록보다 크면 그 값으로 올리고 캐릭터를 다시 평가한다
 *   (횟수가 많을수록 추정이 부풀어서 5회까지만). 3대는 내려가지 않는다(기록을 지워도 그대로).
 * - 날짜는 오늘부터 7일 전까지(늦게 적는 경우), 미래는 안 됨.
 */
@Service
@RequiredArgsConstructor
public class LiftService {
    public static final int PR_POINTS = 5;
    static final int PR_POINT_EXERCISES_PER_DAY = 3;
    static final int MAX_ENTRIES_PER_DAY = 60;
    static final int BACKDATE_DAYS = 7;
    static final int STAT_UPDATE_MAX_REPS = 5;
    static final int HISTORY_DAYS = 180;

    private final LiftEntryRepository liftRepository;
    private final UserBodyStatsRepository statsRepository;
    private final CharacterServiceImpl characterService; // evaluateAndUpdate 는 구현에만 있다(StatsServiceImpl 과 같음)
    private final CharacterGrowthService characterGrowthService;
    private final ExerciseCatalog catalog;
    private final Clock clock;

    public record EntryRequest(LocalDate date, String exercise, Double weightKg, Integer reps, Integer sets) {}

    public record EntryView(Long id, LocalDate date, String exercise, String label, double weightKg, int reps, int sets, double e1rm) {
        static EntryView from(LiftEntry e, String label) {
            return new EntryView(e.getId(), e.getPerformedOn(), e.getExercise(), label,
                    e.getWeightKg(), e.getReps(), e.getSets(), e.getE1rm());
        }
    }

    /** previousE1rm 이 null 이면 그 종목 첫 기록 */
    public record Pr(String exercise, String label, Double previousE1rm, double e1rm, boolean first) {}

    /** 마이페이지 3대 기록을 올렸을 때 */
    public record StatUpdate(String exercise, String label, Double before, double after) {}

    public record SaveResult(EntryView entry, Pr pr, StatUpdate statUpdate, int points, CharacterChangeResponse characterChange) {}

    public record DayView(LocalDate date, LocalDate today, List<EntryView> entries) {}

    public record Best(String exercise, String label, boolean bigThree, double e1rm, double maxWeightKg) {}

    public record Point(LocalDate date, double e1rm) {}

    @Transactional(readOnly = true)
    public DayView day(User me, LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        LocalDate d = date == null ? today : date;
        List<LiftEntry> entries = liftRepository.findAllByUser_IdAndPerformedOnOrderByIdAsc(me.getId(), d);
        Map<String, ExerciseCatalog.ExerciseDef> defs = catalog.describe(entries.stream().map(LiftEntry::getExercise).toList());
        return new DayView(d, today, entries.stream()
                .map(e -> EntryView.from(e, ExerciseCatalog.label(defs, e.getExercise()))).toList());
    }

    @Transactional(readOnly = true)
    public List<Best> bests(User me) {
        Map<String, Object[]> byExercise = new HashMap<>();
        for (Object[] row : liftRepository.findBestsByUserId(me.getId())) {
            byExercise.put((String) row[0], row);
        }
        List<Best> out = new ArrayList<>();
        // 기본 종목은 정해진 순서로, 직접 추가한 종목은 그 뒤에
        for (LiftExercise ex : LiftExercise.values()) {
            Object[] row = byExercise.remove(ex.name());
            if (row != null) {
                out.add(new Best(ex.name(), ex.label, ex.bigThree, round1((Double) row[1]), (Double) row[2]));
            }
        }
        Map<String, ExerciseCatalog.ExerciseDef> defs = catalog.describe(byExercise.keySet());
        byExercise.keySet().stream().sorted().forEach(code -> {
            Object[] row = byExercise.get(code);
            out.add(new Best(code, ExerciseCatalog.label(defs, code), false, round1((Double) row[1]), (Double) row[2]));
        });
        return out;
    }

    @Transactional(readOnly = true)
    public List<Point> history(User me, String exercise) {
        ExerciseCatalog.ExerciseDef ex = requireExercise(me, exercise, true);
        LocalDate from = LocalDate.now(clock).minusDays(HISTORY_DAYS);
        return liftRepository.findDailyBest(me.getId(), ex.code(), from).stream()
                .map(row -> new Point((LocalDate) row[0], round1((Double) row[1])))
                .toList();
    }

    @Transactional
    public SaveResult add(User me, EntryRequest req) {
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "운동 기록을 적어 주세요.");
        }
        ExerciseCatalog.ExerciseDef ex = requireExercise(me, req.exercise(), false);
        if (ex.bodyweight()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "맨몸 운동은 운동 세션에서 기록해 주세요.");
        }
        LocalDate date = checkedDate(req.date());
        double weight = req.weightKg() == null ? 0 : req.weightKg();
        int reps = req.reps() == null ? 0 : req.reps();
        int sets = req.sets() == null ? 1 : req.sets();
        if (weight <= 0 || weight > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "무게는 0.5~500kg 사이로 적어 주세요.");
        }
        if (reps < 1 || reps > 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "횟수는 1~30회 사이로 적어 주세요.");
        }
        if (sets < 1 || sets > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "세트는 1~20세트 사이로 적어 주세요.");
        }
        if (liftRepository.countByUser_IdAndPerformedOn(me.getId(), date) >= MAX_ENTRIES_PER_DAY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "하루에 " + MAX_ENTRIES_PER_DAY + "개까지 기록할 수 있어요.");
        }
        return record(me, ex, date, weight, reps, sets, null);
    }

    /**
     * 기록 한 줄을 저장하고 개인 최고 · 3대 갱신 · 점수를 정한다. 운동 세션(WorkoutSessionService)도 종목마다 가장 좋은 세트로 이걸 부른다.
     * 값 검사는 부르는 쪽에서 한다.
     */
    @Transactional
    public SaveResult record(User me, ExerciseCatalog.ExerciseDef ex, LocalDate date, double weight, int reps, int sets, Long sessionId) {
        weight = Math.round(weight * 4) / 4.0; // 0.25kg 단위
        double e1rm = round1(estimate1rm(weight, reps));

        // 이번 기록 전의 기록들로 개인 최고 판단
        List<LiftEntry> before = liftRepository.findAllByUser_IdAndExerciseOrPerformedOn(me.getId(), ex.code(), date);
        LiftEntry saved = liftRepository.save(LiftEntry.builder().user(me).performedOn(date).exercise(ex.code())
                .weightKg(weight).reps(reps).sets(sets).e1rm(e1rm).sessionId(sessionId).build());

        Double prevBest = null;
        Set<String> prExercisesToday = new HashSet<>();
        Map<String, Double> bestOtherDaysByEx = new HashMap<>();
        Map<String, Double> bestTodayByEx = new HashMap<>();
        for (LiftEntry e : before) {
            if (e.getPerformedOn().equals(date)) {
                bestTodayByEx.merge(e.getExercise(), e.getE1rm(), Math::max);
            } else {
                bestOtherDaysByEx.merge(e.getExercise(), e.getE1rm(), Math::max);
            }
        }
        for (Map.Entry<String, Double> t : bestTodayByEx.entrySet()) {
            Double other = bestOtherDaysByEx.get(t.getKey());
            if (other == null || t.getValue() > other) prExercisesToday.add(t.getKey());
        }
        Double prevBestOtherDays = bestOtherDaysByEx.get(ex.code());
        Double prevBestToday = bestTodayByEx.get(ex.code());
        if (prevBestOtherDays != null || prevBestToday != null) {
            prevBest = Math.max(prevBestOtherDays == null ? 0 : prevBestOtherDays, prevBestToday == null ? 0 : prevBestToday);
        }

        Pr pr = null;
        int points = 0;
        if (prevBest == null || e1rm > prevBest) {
            pr = new Pr(ex.code(), ex.label(), prevBest, e1rm, prevBest == null);
            boolean alreadyToday = prExercisesToday.contains(ex.code());
            if (!alreadyToday && prExercisesToday.size() < PR_POINT_EXERCISES_PER_DAY) {
                points = PR_POINTS;
            }
        }

        CharacterChangeResponse change = null;
        StatUpdate statUpdate = null;
        LiftExercise three = ex.bigThree() ? LiftExercise.parse(ex.code()) : null;
        if (three != null && reps <= STAT_UPDATE_MAX_REPS) {
            UserBodyStats stats = statsRepository.findByUser(me).orElse(null);
            if (stats != null) {
                double candidate = Math.round(e1rm * 2) / 2.0; // 0.5kg 단위
                Double current = currentStat(stats, three);
                if (current == null || candidate > current) {
                    setStat(stats, three, candidate);
                    statsRepository.save(stats);
                    statUpdate = new StatUpdate(ex.code(), ex.label(), current, candidate);
                    StatsCharacterResponse res = characterService.evaluateAndUpdate(me, stats, CharacterEvolutionTriggerType.STATS_UPDATED);
                    change = res == null ? null : res.getChange();
                }
            }
        }
        if (points > 0) {
            CharacterChangeResponse fromPoints = characterGrowthService.applyAttendance(me, points);
            if (change == null) change = fromPoints;
        }
        return new SaveResult(EntryView.from(saved, ex.label()), pr, statUpdate, points, change);
    }

    @Transactional
    public void delete(User me, Long id) {
        LiftEntry e = liftRepository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록을 찾을 수 없어요."));
        liftRepository.delete(e);
    }

    static double estimate1rm(double weight, int reps) {
        return reps <= 1 ? weight : weight * (1 + reps / 30.0);
    }

    private ExerciseCatalog.ExerciseDef requireExercise(User me, String code, boolean allowDeleted) {
        ExerciseCatalog.ExerciseDef ex = catalog.resolve(me, code, allowDeleted);
        if (ex == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종목을 골라 주세요.");
        }
        return ex;
    }

    private LocalDate checkedDate(LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        LocalDate d = date == null ? today : date;
        if (d.isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "미래 날짜에는 기록할 수 없어요.");
        }
        if (d.isBefore(today.minusDays(BACKDATE_DAYS))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "운동 기록은 " + BACKDATE_DAYS + "일 전까지 적을 수 있어요.");
        }
        return d;
    }

    private static Double currentStat(UserBodyStats s, LiftExercise ex) {
        return switch (ex) {
            case SQUAT -> s.getSquatKg();
            case BENCH -> s.getBenchKg();
            case DEADLIFT -> s.getDeadliftKg();
            default -> null;
        };
    }

    private static void setStat(UserBodyStats s, LiftExercise ex, double v) {
        switch (ex) {
            case SQUAT -> s.setSquatKg(v);
            case BENCH -> s.setBenchKg(v);
            case DEADLIFT -> s.setDeadliftKg(v);
            default -> { }
        }
    }

    static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
