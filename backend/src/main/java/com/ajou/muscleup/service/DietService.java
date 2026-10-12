package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.DietGoal;
import com.ajou.muscleup.entity.DietSource;
import com.ajou.muscleup.entity.MealEntry;
import com.ajou.muscleup.entity.MealType;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.DietGoalRepository;
import com.ajou.muscleup.repository.MealEntryRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 식단 기록(직접 입력)과 하루 영양 목표. 사진 인식(PR B)도 결국 여기 add 로 저장한다.
 * 모든 기록은 본인만 읽고 쓴다 — 남의 기록 id 는 404.
 */
@Service
@RequiredArgsConstructor
public class DietService {
    static final int MAX_ENTRIES_PER_DAY = 60;
    static final int MAX_RANGE_DAYS = 31;
    static final LocalDate EARLIEST = LocalDate.of(2020, 1, 1);
    /** 목표가 없을 때 체중 × 1.6g 을 단백질 제안으로(근력 운동 일반 권장 1.6~2.2g/kg 의 아래쪽) */
    static final double PROTEIN_PER_KG = 1.6;

    private final MealEntryRepository entryRepository;
    private final DietGoalRepository goalRepository;
    private final UserBodyStatsRepository bodyStatsRepository;
    private final Clock clock;

    public record EntryRequest(LocalDate date, MealType mealType, String name, String amount,
                               Integer kcal, Double proteinG, Double carbG, Double fatG) {}

    public record EntryView(Long id, LocalDate date, MealType mealType, String name, String amount,
                            Integer kcal, Double proteinG, Double carbG, Double fatG, DietSource source) {
        static EntryView from(MealEntry e) {
            return new EntryView(e.getId(), e.getEatenOn(), e.getMealType(), e.getName(), e.getAmount(),
                    e.getKcal(), e.getProteinG(), e.getCarbG(), e.getFatG(), e.getSource());
        }
    }

    public record Totals(int kcal, double proteinG, double carbG, double fatG, int count) {
        static Totals of(List<MealEntry> entries) {
            int kcal = 0;
            double p = 0, c = 0, f = 0;
            for (MealEntry e : entries) {
                if (e.getKcal() != null) kcal += e.getKcal();
                if (e.getProteinG() != null) p += e.getProteinG();
                if (e.getCarbG() != null) c += e.getCarbG();
                if (e.getFatG() != null) f += e.getFatG();
            }
            return new Totals(kcal, round1(p), round1(c), round1(f), entries.size());
        }
    }

    public record GoalRequest(Integer kcal, Integer proteinG, Integer carbG, Integer fatG, DietSource source) {}

    /** saved=false 면 저장된 목표가 없고 체중으로 만든 제안(단백질만) */
    public record GoalView(Integer kcal, Integer proteinG, Integer carbG, Integer fatG, String source, boolean saved) {}

    public record DayView(LocalDate date, LocalDate today, List<EntryView> entries, Totals totals, GoalView goal) {}

    public record DaySummary(LocalDate date, Totals totals) {}

    public record RecentFood(String name, String amount, Integer kcal, Double proteinG, Double carbG, Double fatG) {}

    @Transactional(readOnly = true)
    public DayView day(User me, LocalDate date) {
        LocalDate day = date != null ? date : today();
        List<MealEntry> entries = new ArrayList<>(entryRepository.findAllByUser_IdAndEatenOnOrderByCreatedAtAsc(me.getId(), day));
        entries.sort(Comparator.comparing(MealEntry::getMealType)); // 안정 정렬이라 끼니 안에서는 입력 순서 유지
        return new DayView(day, today(), entries.stream().map(EntryView::from).toList(), Totals.of(entries), goal(me));
    }

    @Transactional(readOnly = true)
    public List<DaySummary> summary(User me, LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : today();
        LocalDate start = from != null ? from : end.minusDays(6);
        if (start.isAfter(end) || ChronoUnit.DAYS.between(start, end) >= MAX_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "기간은 " + MAX_RANGE_DAYS + "일까지 볼 수 있어요.");
        }
        Map<LocalDate, List<MealEntry>> byDay = new HashMap<>();
        for (MealEntry e : entryRepository.findAllByUser_IdAndEatenOnBetween(me.getId(), start, end)) {
            byDay.computeIfAbsent(e.getEatenOn(), d -> new ArrayList<>()).add(e);
        }
        List<DaySummary> out = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            out.add(new DaySummary(d, Totals.of(byDay.getOrDefault(d, List.of()))));
        }
        return out;
    }

    @Transactional
    public EntryView add(User me, EntryRequest req) {
        return add(me, req, DietSource.MANUAL);
    }

    @Transactional
    public EntryView add(User me, EntryRequest req, DietSource source) {
        LocalDate day = checkedDate(req == null ? null : req.date());
        if (entryRepository.countByUser_IdAndEatenOn(me.getId(), day) >= MAX_ENTRIES_PER_DAY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "하루에 " + MAX_ENTRIES_PER_DAY + "개까지 기록할 수 있어요.");
        }
        MealEntry e = MealEntry.builder().user(me).eatenOn(day).source(source).build();
        apply(e, req);
        return EntryView.from(entryRepository.save(e));
    }

    @Transactional
    public EntryView update(User me, Long id, EntryRequest req) {
        MealEntry e = mine(me, id);
        if (req != null && req.date() != null) e.setEatenOn(checkedDate(req.date()));
        apply(e, req);
        return EntryView.from(e);
    }

    @Transactional
    public void delete(User me, Long id) {
        entryRepository.delete(mine(me, id));
    }

    /** 최근에 적은 음식(이름이 같은 것은 가장 최근 한 번만) — 다시 넣기 버튼용 */
    @Transactional(readOnly = true)
    public List<RecentFood> recentFoods(User me) {
        Set<String> seen = new HashSet<>();
        List<RecentFood> out = new ArrayList<>();
        for (MealEntry e : entryRepository.findAllByUser_IdOrderByCreatedAtDesc(me.getId(), PageRequest.of(0, 200))) {
            if (!seen.add(e.getName().toLowerCase())) continue;
            out.add(new RecentFood(e.getName(), e.getAmount(), e.getKcal(), e.getProteinG(), e.getCarbG(), e.getFatG()));
            if (out.size() >= 20) break;
        }
        return out;
    }

    @Transactional(readOnly = true)
    public GoalView goal(User me) {
        DietGoal g = goalRepository.findByUser_Id(me.getId()).orElse(null);
        if (g != null) {
            return new GoalView(g.getKcal(), g.getProteinG(), g.getCarbG(), g.getFatG(), g.getSource().name(), true);
        }
        return bodyStatsRepository.findByUser(me)
                .filter(s -> s.getWeightKg() != null && s.getWeightKg() > 0)
                .map(s -> new GoalView(null, (int) Math.round(s.getWeightKg() * PROTEIN_PER_KG), null, null, "BODY_STATS", false))
                .orElse(null);
    }

    @Transactional
    public GoalView saveGoal(User me, GoalRequest req) {
        if (req == null || (req.kcal() == null && req.proteinG() == null && req.carbG() == null && req.fatG() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "목표를 하나 이상 적어 주세요.");
        }
        DietGoal g = goalRepository.findByUser_Id(me.getId()).orElseGet(() -> DietGoal.builder().user(me).build());
        g.setKcal(range(req.kcal(), 0, 10000, "칼로리"));
        g.setProteinG(range(req.proteinG(), 0, 1000, "단백질"));
        g.setCarbG(range(req.carbG(), 0, 1500, "탄수화물"));
        g.setFatG(range(req.fatG(), 0, 1000, "지방"));
        g.setSource(req.source() == DietSource.INBODY ? DietSource.INBODY : DietSource.MANUAL);
        goalRepository.save(g);
        return goal(me);
    }

    @Transactional
    public void deleteGoal(User me) {
        goalRepository.findByUser_Id(me.getId()).ifPresent(goalRepository::delete);
    }

    // ---- 내부 ----

    private MealEntry mine(User me, Long id) {
        return entryRepository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록을 찾을 수 없어요."));
    }

    private void apply(MealEntry e, EntryRequest req) {
        if (req == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "음식 이름을 적어 주세요.");
        if (req.mealType() == null && e.getMealType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "끼니를 골라 주세요.");
        }
        if (req.mealType() != null) e.setMealType(req.mealType());
        String name = req.name() == null ? "" : req.name().strip();
        if (name.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "음식 이름을 적어 주세요.");
        if (name.length() > 60) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "음식 이름은 60자까지예요.");
        e.setName(name);
        String amount = req.amount() == null ? null : req.amount().strip();
        if (amount != null && amount.length() > 30) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "양은 30자까지예요.");
        e.setAmount(amount == null || amount.isEmpty() ? null : amount);
        e.setKcal(range(req.kcal(), 0, 5000, "칼로리"));
        e.setProteinG(grams(req.proteinG(), "단백질"));
        e.setCarbG(grams(req.carbG(), "탄수화물"));
        e.setFatG(grams(req.fatG(), "지방"));
    }

    private LocalDate checkedDate(LocalDate date) {
        LocalDate today = today();
        LocalDate day = date != null ? date : today;
        if (day.isAfter(today)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "앞으로의 날짜에는 기록할 수 없어요.");
        if (day.isBefore(EARLIEST)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "날짜를 확인해 주세요.");
        return day;
    }

    private static Integer range(Integer v, int min, int max, String label) {
        if (v == null) return null;
        if (v < min || v > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " 값을 확인해 주세요.");
        return v;
    }

    private static Double grams(Double v, String label) {
        if (v == null) return null;
        if (v.isNaN() || v < 0 || v > 500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " 값을 확인해 주세요.");
        return round1(v);
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
