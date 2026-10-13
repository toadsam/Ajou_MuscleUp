package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.GymDecorSlot;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.GymDecorSlotRepository;
import com.ajou.muscleup.repository.LiftEntryRepository;
import com.ajou.muscleup.repository.MealEntryRepository;
import com.ajou.muscleup.repository.MyFoodRepository;
import com.ajou.muscleup.repository.RunSessionRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutSessionRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
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
 * 홈 헬스장 꾸미기 1단계 — 기록을 채우면 물품이 생기고, 꾸미기 자리(슬롯)에 넣거나 뺀다.
 * - 얻었는지는 저장하지 않고 기록에서 계산한다. 그래서 이미 운동해 온 사람도 처음 열 때 한 만큼 열려 있다.
 * - 저장하는 건 "어느 자리에 무엇을 놓았나"(gym_decor_slots)뿐. 줄이 없으면 그 자리 기본 물품.
 * - 한 물품은 한 자리에만(화분 빼고). 다른 자리에 넣으면 원래 자리는 빈다.
 * - 놓아 둔 물품의 조건이 나중에 깨지면(기록 삭제 등) 그 자리는 빈 것으로 보여 준다.
 */
@Service
@RequiredArgsConstructor
public class GymDecorService {
    private static final LocalDate EPOCH = LocalDate.of(2000, 1, 1);
    private static final Set<String> BIG_THREE = Set.of("SQUAT", "BENCH", "DEADLIFT");

    private final GymDecorSlotRepository slotRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final WorkoutCrewMemberRepository crewMemberRepository;
    private final LiftEntryRepository liftEntryRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final RunSessionRepository runSessionRepository;
    private final MealEntryRepository mealEntryRepository;
    private final MyFoodRepository myFoodRepository;
    private final UserBodyStatsRepository bodyStatsRepository;
    private final WeeklyGoalService weeklyGoalService;
    private final Clock clock;

    public record SlotView(String slot, String code) {}

    public record ItemView(String code, String label, List<String> slots, boolean multi, boolean owned,
                           int progress, int goal, String hint) {}

    public record View(List<SlotView> slots, List<ItemView> items, int owned, int total) {}

    @Transactional(readOnly = true)
    public View view(User me) {
        return build(me, new Progress(me));
    }

    /** slot 자리에 code 를 놓는다. code 가 null 이면 비운다 */
    @Transactional
    public View place(User me, String slotName, String code) {
        GymDecorItem.Slot slot = GymDecorItem.Slot.parse(slotName);
        if (slot == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "꾸미기 자리를 알 수 없어요.");
        Progress progress = new Progress(me);
        GymDecorItem item = null;
        if (code != null && !code.isBlank()) {
            item = GymDecorItem.parse(code);
            if (item == null || !item.slots.contains(slot)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 자리에 놓을 수 없는 물품이에요.");
            }
            if (!progress.owned(item)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아직 얻지 못한 물품이에요.");
            }
        }
        Map<GymDecorItem.Slot, GymDecorSlot> rows = rows(me);
        if (item != null && !item.multi) {
            // 다른 자리에 놓여 있던 같은 물품은 뺀다
            for (GymDecorItem.Slot other : GymDecorItem.Slot.values()) {
                if (other != slot && item.name().equals(placed(rows, other))) {
                    upsert(me, rows, other, null);
                }
            }
        }
        upsert(me, rows, slot, item == null ? null : item.name());
        return build(me, progress);
    }

    private View build(User me, Progress progress) {
        Map<GymDecorItem.Slot, GymDecorSlot> rows = rows(me);
        List<SlotView> slots = new ArrayList<>();
        for (GymDecorItem.Slot slot : GymDecorItem.Slot.values()) {
            GymDecorItem item = GymDecorItem.parse(placed(rows, slot));
            slots.add(new SlotView(slot.name(), item != null && progress.owned(item) ? item.name() : null));
        }
        List<ItemView> items = new ArrayList<>();
        int owned = 0;
        for (GymDecorItem item : GymDecorItem.values()) {
            boolean has = progress.owned(item);
            if (has) owned++;
            int goal = item.isDefault() ? 0 : item.target;
            int value = item.isDefault() ? 0 : Math.min(goal, progress.of(item.goal));
            items.add(new ItemView(item.name(), item.label, item.slots.stream().map(Enum::name).toList(), item.multi, has,
                    value, goal, item.isDefault() ? "처음부터 있어요" : item.goal.hint(item.target)));
        }
        return new View(slots, items, owned, GymDecorItem.values().length);
    }

    private Map<GymDecorItem.Slot, GymDecorSlot> rows(User me) {
        Map<GymDecorItem.Slot, GymDecorSlot> rows = new EnumMap<>(GymDecorItem.Slot.class);
        for (GymDecorSlot row : slotRepository.findAllByUser_Id(me.getId())) {
            GymDecorItem.Slot slot = GymDecorItem.Slot.parse(row.getSlot());
            if (slot != null) rows.put(slot, row);
        }
        return rows;
    }

    /** 그 자리에 놓인 물품 코드(줄이 없으면 기본 물품) */
    private static String placed(Map<GymDecorItem.Slot, GymDecorSlot> rows, GymDecorItem.Slot slot) {
        GymDecorSlot row = rows.get(slot);
        return row == null ? slot.defaultItem : row.getItemCode();
    }

    private void upsert(User me, Map<GymDecorItem.Slot, GymDecorSlot> rows, GymDecorItem.Slot slot, String code) {
        GymDecorSlot row = rows.get(slot);
        if (row == null) {
            row = slotRepository.save(GymDecorSlot.builder().user(me).slot(slot.name()).itemCode(code).build());
            rows.put(slot, row);
        } else {
            row.setItemCode(code);
        }
    }

    /** 조건 진행도 — 필요한 것만 한 번씩 센다 */
    private final class Progress {
        private final User me;
        private final Map<GymDecorItem.Goal, Integer> cache = new EnumMap<>(GymDecorItem.Goal.class);
        private Set<String> lifts;
        private UserBodyStats body;
        private boolean bodyLoaded;

        Progress(User me) {
            this.me = me;
        }

        boolean owned(GymDecorItem item) {
            return item.isDefault() || of(item.goal) >= item.target;
        }

        int of(GymDecorItem.Goal goal) {
            return cache.computeIfAbsent(goal, this::compute);
        }

        private int compute(GymDecorItem.Goal goal) {
            Long id = me.getId();
            return switch (goal) {
                case ATTENDANCE -> (int) attendanceLogRepository.countByUserAndDidWorkoutTrueAndDateBetween(me, EPOCH, LocalDate.now(clock));
                case CREW -> crewMemberRepository.findCrewIdsByUserId(id).size();
                case BIG_THREE -> bigThree();
                case SESSIONS -> (int) workoutSessionRepository.countByUser_Id(id);
                case EXERCISES -> lifts().size();
                case BENCH -> lifted("BENCH", body() == null ? null : body().getBenchKg()) ? 1 : 0;
                case RUN_KM -> (int) (runSessionRepository.sumDistanceByUserId(id) / 1000);
                case DIET_DAYS -> (int) mealEntryRepository.countDaysByUserId(id);
                case MY_FOODS -> (int) myFoodRepository.countByUser_Id(id);
                case WEEKLY_STREAK -> weeklyGoalService.status(me).streakWeeks();
                case BODY -> body() != null && body().getWeightKg() != null ? 1 : 0;
            };
        }

        /** 3대 중 기록이 있는 종목 수(운동 기록 또는 예전 3대 입력) */
        private int bigThree() {
            UserBodyStats b = body();
            int n = 0;
            if (lifted("SQUAT", b == null ? null : b.getSquatKg())) n++;
            if (lifted("BENCH", b == null ? null : b.getBenchKg())) n++;
            if (lifted("DEADLIFT", b == null ? null : b.getDeadliftKg())) n++;
            return n;
        }

        private boolean lifted(String exercise, Double typedKg) {
            return lifts().contains(exercise) || (BIG_THREE.contains(exercise) && typedKg != null && typedKg > 0);
        }

        /** 운동 기록에 남은 종목들 */
        private Set<String> lifts() {
            if (lifts == null) {
                lifts = new HashSet<>();
                for (Object[] row : liftEntryRepository.findBestsByUserId(me.getId())) {
                    if (row[0] instanceof String code) lifts.add(code);
                }
            }
            return lifts;
        }

        private UserBodyStats body() {
            if (!bodyLoaded) {
                body = bodyStatsRepository.findByUser(me).orElse(null);
                bodyLoaded = true;
            }
            return body;
        }
    }
}
