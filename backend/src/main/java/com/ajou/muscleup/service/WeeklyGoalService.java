package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WeeklyGoalSetting;
import com.ajou.muscleup.entity.WeeklyGoalWeek;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.WeeklyGoalSettingRepository;
import com.ajou.muscleup.repository.WeeklyGoalWeekRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 주간 목표 연속 기록. 헬스는 매일 하면 안 되는 운동이라 "매일 연속" 대신 "한 주에 N번"을 몇 주 이어 갔는지 센다.
 * - 한 주 = 월~일(한국 시간, Clock). 운동한 날(didWorkout) 수가 그 주 목표 이상이면 달성.
 * - 연속: 이번 주는 달성했을 때만 세고(진행 중이면 끊지 않음), 지난주부터 거꾸로 달성한 주를 센다. 쉬는 주는 건너뛴다.
 * - 이번 주를 처음 달성하면 보너스 점수(한 주에 한 번, 연속이 길수록 조금 더) — 출석 점수와 같은 곳(캐릭터 활동 보너스)에 쌓인다.
 * - 목표 바꾸기: 이번 주에 아직 운동 안 했으면 바로, 했으면 다음 주부터(주 중간에 낮춰 연속을 지키는 걸 막음).
 * - 쉬는 주: 아직 달성 안 한 이번 주만, 최근 4주 안에 한 번. 쉬는 주에 목표를 채우면 그냥 달성으로 친다.
 */
@Service
@RequiredArgsConstructor
public class WeeklyGoalService {
    public static final int DEFAULT_TARGET = 3;
    public static final int MIN_TARGET = 1;
    public static final int MAX_TARGET = 7;
    /** 연속을 거꾸로 셀 때 최대 몇 주까지 보나(2년) */
    static final int LOOKBACK_WEEKS = 104;
    /** 쉬는 주는 이 주 수 안에 한 번 */
    static final int REST_WINDOW_WEEKS = 4;

    private final WeeklyGoalSettingRepository settingRepository;
    private final WeeklyGoalWeekRepository weekRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final Clock clock;

    /**
     * @param days        이번 주 월~일 운동 여부(7칸)
     * @param nextTarget  다음 주부터 적용될 목표(= 지금 설정)
     * @param streakWeeks 연속 달성 주 수(이번 주는 달성했을 때만 포함)
     * @param bonusPoints 이번 주를 달성하면(했으면) 받는 보너스
     */
    public record Status(LocalDate weekStart, LocalDate weekEnd, int target, int nextTarget, int done,
                         List<Boolean> days, boolean achieved, boolean rest, boolean canRest,
                         int streakWeeks, int bonusPoints, boolean rewarded) {}

    /** 출석으로 이번 주 목표를 처음 채웠을 때 */
    public record Reward(int bonusPoints, int streakWeeks) {}

    @Transactional(readOnly = true)
    public Status status(User user) {
        return compute(user, LocalDate.now(clock));
    }

    @Transactional
    public Status setTarget(User user, int target) {
        if (target < MIN_TARGET || target > MAX_TARGET) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "주간 목표는 1~7번 사이로 정해 주세요.");
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate ws = weekStart(today);
        int currentSetting = settingTarget(user);
        int doneThisWeek = countWorkouts(user, ws, today);
        WeeklyGoalWeek week = weekRepository.findByUser_IdAndWeekStart(user.getId(), ws).orElse(null);
        boolean applyNow = doneThisWeek == 0 && (week == null || !week.isRewarded());
        if (applyNow) {
            if (week != null) {
                week.setTarget(target);
            }
        } else if (week == null) {
            // 이번 주는 바꾸기 전 목표로 고정해 둔다(행이 없으면 지금 설정을 따라가므로)
            weekRepository.save(newWeek(user, ws, currentSetting));
        }
        WeeklyGoalSetting setting = settingRepository.findByUser_Id(user.getId())
                .orElseGet(() -> WeeklyGoalSetting.builder().user(user).build());
        setting.setTarget(target);
        settingRepository.save(setting);
        return compute(user, today);
    }

    @Transactional
    public Status setRest(User user, boolean rest) {
        LocalDate today = LocalDate.now(clock);
        LocalDate ws = weekStart(today);
        Status now = compute(user, today);
        if (rest == now.rest()) {
            return now;
        }
        if (rest && !now.canRest()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, now.achieved()
                    ? "이번 주는 이미 목표를 채웠어요."
                    : "쉬는 주는 4주에 한 번만 쓸 수 있어요.");
        }
        WeeklyGoalWeek week = weekRepository.findByUser_IdAndWeekStart(user.getId(), ws)
                .orElseGet(() -> newWeek(user, ws, settingTarget(user)));
        week.setRest(rest);
        weekRepository.save(week);
        return compute(user, today);
    }

    /**
     * 출석이 "운동 안 함 → 운동함"으로 바뀐 뒤(같은 트랜잭션) 부른다. 이번 주 목표를 처음 채웠으면 보너스를 돌려준다.
     * 이번 주가 아닌 날(어제가 지난주 일요일인 경우의 수정)은 연속 계산에만 반영되고 보너스는 없다.
     */
    @Transactional
    public Reward onWorkoutAdded(User user, LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        LocalDate ws = weekStart(today);
        if (date.isBefore(ws) || date.isAfter(today)) {
            return null;
        }
        WeeklyGoalWeek week = weekRepository.findByUser_IdAndWeekStart(user.getId(), ws)
                .orElseGet(() -> weekRepository.save(newWeek(user, ws, settingTarget(user))));
        if (week.isRewarded() || countWorkouts(user, ws, today) < week.getTarget()) {
            return null;
        }
        week.setRewarded(true);
        week.setRest(false);
        weekRepository.save(week);
        int streak = compute(user, today).streakWeeks();
        return new Reward(bonusFor(streak), streak);
    }

    /** 10점 + 연속 주마다 2점(최대 20점). 출석 한 번이 보통 6~15점 */
    static int bonusFor(int streakWeeks) {
        return 8 + 2 * Math.max(1, Math.min(streakWeeks, 6));
    }

    static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private Status compute(User user, LocalDate today) {
        LocalDate ws = weekStart(today);
        LocalDate from = ws.minusWeeks(LOOKBACK_WEEKS);
        int setting = settingTarget(user);

        Map<LocalDate, Integer> doneByWeek = new HashMap<>();
        List<Boolean> days = new ArrayList<>(List.of(false, false, false, false, false, false, false));
        for (Object[] row : attendanceLogRepository.findDateFlagsByUserIdAndDateRange(user.getId(), from, today)) {
            if (!Boolean.TRUE.equals(row[1])) continue;
            LocalDate d = (LocalDate) row[0];
            doneByWeek.merge(weekStart(d), 1, Integer::sum);
            if (!d.isBefore(ws)) {
                days.set(d.getDayOfWeek().getValue() - 1, true);
            }
        }
        Map<LocalDate, WeeklyGoalWeek> weeks = new HashMap<>();
        for (WeeklyGoalWeek w : weekRepository.findAllByUser_IdAndWeekStartBetween(user.getId(), from, ws)) {
            weeks.put(w.getWeekStart(), w);
        }

        WeeklyGoalWeek current = weeks.get(ws);
        int target = current != null ? current.getTarget() : setting;
        int done = doneByWeek.getOrDefault(ws, 0);
        boolean achieved = done >= target;
        boolean rest = current != null && current.isRest() && !achieved;

        int streak = achieved ? 1 : 0;
        for (LocalDate w = ws.minusWeeks(1); !w.isBefore(from); w = w.minusWeeks(1)) {
            WeeklyGoalWeek row = weeks.get(w);
            int t = row != null ? row.getTarget() : setting;
            if (doneByWeek.getOrDefault(w, 0) >= t) {
                streak++;
            } else if (row == null || !row.isRest()) {
                break;
            }
        }

        boolean restUsedRecently = false;
        for (int i = 1; i < REST_WINDOW_WEEKS; i++) {
            WeeklyGoalWeek row = weeks.get(ws.minusWeeks(i));
            if (row != null && row.isRest() && doneByWeek.getOrDefault(row.getWeekStart(), 0) < row.getTarget()) {
                restUsedRecently = true;
                break;
            }
        }
        boolean canRest = !achieved && !rest && !restUsedRecently;
        boolean rewarded = current != null && current.isRewarded();
        int bonus = bonusFor(achieved ? streak : streak + 1);
        return new Status(ws, ws.plusDays(6), target, setting, done, days, achieved, rest, canRest,
                streak, bonus, rewarded);
    }

    private int countWorkouts(User user, LocalDate from, LocalDate to) {
        int n = 0;
        for (Object[] row : attendanceLogRepository.findDateFlagsByUserIdAndDateRange(user.getId(), from, to)) {
            if (Boolean.TRUE.equals(row[1])) n++;
        }
        return n;
    }

    private int settingTarget(User user) {
        return settingRepository.findByUser_Id(user.getId()).map(WeeklyGoalSetting::getTarget).orElse(DEFAULT_TARGET);
    }

    private static WeeklyGoalWeek newWeek(User user, LocalDate ws, int target) {
        return WeeklyGoalWeek.builder().user(user).weekStart(ws).target(target).build();
    }
}
