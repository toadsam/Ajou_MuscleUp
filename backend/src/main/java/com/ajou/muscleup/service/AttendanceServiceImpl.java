package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
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

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final List<String> ALLOWED_TYPES = List.of("weight", "cardio", "stretch");
    private static final Set<String> ALLOWED_INTENSITIES = Set.of("light", "normal", "hard");
    private static final Map<String, Integer> INTENSITY_POINTS = Map.of(
            "light", 1,
            "normal", 2,
            "hard", 3
    );
    private static final List<String> MEMO_KEYWORDS = List.of("3대", "갱신", "PR", "데드", "스쿼트");

    private final AttendanceLogRepository attendanceLogRepository;
    private final UserRepository userRepository;
    private final EventService eventService;
    private final CharacterGrowthService characterGrowthService;

    @Override
    @Transactional
    public AttendanceLogResponse upsertToday(String email, AttendanceUpsertRequest request) {
        User user = getUserOrThrow(email);
        LocalDate today = LocalDate.now(KST);
        UpsertResult result = upsert(user, today, request);
        List<EventProgressResponse> eventProgress =
                eventService.updateAttendanceProgress(user, today, result.previousDidWorkout, result.currentDidWorkout);
        CharacterChangeResponse change = characterGrowthService.applyAttendance(user, result.pointsEarned);
        return AttendanceLogResponse.from(result.log, eventProgress, change, result.pointsEarned);
    }

    @Override
    @Transactional
    public AttendanceLogResponse upsertByDate(String email, LocalDate date, AttendanceUpsertRequest request) {
        User user = getUserOrThrow(email);
        UpsertResult result = upsert(user, date, request);
        List<EventProgressResponse> eventProgress =
                eventService.updateAttendanceProgress(user, date, result.previousDidWorkout, result.currentDidWorkout);
        CharacterChangeResponse change = characterGrowthService.applyAttendance(user, result.pointsEarned);
        return AttendanceLogResponse.from(result.log, eventProgress, change, result.pointsEarned);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceLogResponse> getMonthlyLogs(String email, YearMonth month) {
        User user = getUserOrThrow(email);
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        return attendanceLogRepository.findAllByUserAndDateBetweenOrderByDateAsc(user, start, end)
                .stream()
                .map(AttendanceLogResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AttendanceSummaryResponse getSummary(String email, YearMonth month) {
        User user = getUserOrThrow(email);
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();

        long monthWorkoutCount =
                attendanceLogRepository.countByUserAndDidWorkoutTrueAndDateBetween(user, start, end);
        int currentStreak = calculateCurrentStreak(user, LocalDate.now(KST));
        Integer bestStreakInMonth = calculateBestStreakInMonth(user, start, end);

        return AttendanceSummaryResponse.builder()
                .monthWorkoutCount(monthWorkoutCount)
                .currentStreak(currentStreak)
                .bestStreakInMonth(bestStreakInMonth)
                .build();
    }

    private UpsertResult upsert(User user, LocalDate date, AttendanceUpsertRequest request) {
        AttendanceInput input = normalizeInput(request);
        AttendanceLog existing = attendanceLogRepository.findByUserAndDate(user, date).orElse(null);
        if (existing != null) {
            if (isSame(existing, input, request.getMemo())) {
                return new UpsertResult(existing, existing.isDidWorkout(), existing.isDidWorkout(), 0);
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Attendance already recorded for this date.");
        }

        AttendanceLog log = AttendanceLog.builder()
                .user(user)
                .date(date)
                .didWorkout(input.didWorkout())
                .memo(normalizeMemo(request.getMemo()))
                .workoutTypes(input.workoutTypesCsv())
                .workoutIntensity(input.workoutIntensity())
                .build();
        AttendanceLog saved = attendanceLogRepository.save(log);

        int pointsEarned = input.didWorkout() ? calculatePointsEarned(user, date, input, request.getMemo()) : 0;
        return new UpsertResult(saved, false, input.didWorkout(), pointsEarned);
    }

    private int calculateCurrentStreak(User user, LocalDate today) {
        AttendanceLog todayLog = attendanceLogRepository.findByUserAndDate(user, today).orElse(null);
        if (todayLog != null && !todayLog.isDidWorkout()) {
            return 0;
        }

        LocalDate cursor = (todayLog != null) ? today : today.minusDays(1);
        int streak = 0;
        while (true) {
            AttendanceLog log = attendanceLogRepository.findByUserAndDate(user, cursor).orElse(null);
            if (log == null || !log.isDidWorkout()) {
                break;
            }
            streak += 1;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private Integer calculateBestStreakInMonth(User user, LocalDate start, LocalDate end) {
        List<AttendanceLog> logs = attendanceLogRepository.findAllByUserAndDateBetweenOrderByDateAsc(user, start, end);
        if (logs.isEmpty()) {
            return 0;
        }

        Map<LocalDate, Boolean> map = new HashMap<>();
        for (AttendanceLog log : logs) {
            map.put(log.getDate(), log.isDidWorkout());
        }

        int best = 0;
        int current = 0;
        LocalDate cursor = start;
        while (!cursor.isAfter(end)) {
            if (Boolean.TRUE.equals(map.get(cursor))) {
                current += 1;
                best = Math.max(best, current);
            } else {
                current = 0;
            }
            cursor = cursor.plusDays(1);
        }
        return best;
    }

    private AttendanceInput normalizeInput(AttendanceUpsertRequest request) {
        boolean didWorkout = Boolean.TRUE.equals(request.getDidWorkout());
        if (!didWorkout) {
            return new AttendanceInput(false, List.of(), null, null);
        }

        List<String> normalizedTypes = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (request.getWorkoutTypes() != null) {
            for (String raw : request.getWorkoutTypes()) {
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                String value = raw.trim().toLowerCase();
                if (!ALLOWED_TYPES.contains(value)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid workout type: " + raw);
                }
                if (seen.add(value)) {
                    normalizedTypes.add(value);
                }
            }
        }
        if (normalizedTypes.size() > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workout type limit exceeded.");
        }

        String intensity = null;
        if (request.getWorkoutIntensity() != null && !request.getWorkoutIntensity().isBlank()) {
            intensity = request.getWorkoutIntensity().trim().toLowerCase();
            if (!ALLOWED_INTENSITIES.contains(intensity)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid workout intensity.");
            }
        }

        return new AttendanceInput(true, normalizedTypes, intensity, joinTypes(normalizedTypes));
    }

    private boolean isSame(AttendanceLog log, AttendanceInput input, String memo) {
        String normalizedMemo = normalizeMemo(memo);
        String existingMemo = normalizeMemo(log.getMemo());
        String existingTypes = log.getWorkoutTypes() == null ? null : log.getWorkoutTypes();
        String inputTypes = input.workoutTypesCsv();
        String existingIntensity = log.getWorkoutIntensity();
        return log.isDidWorkout() == input.didWorkout()
                && equalsNullable(existingMemo, normalizedMemo)
                && equalsNullable(existingTypes, inputTypes)
                && equalsNullable(existingIntensity, input.workoutIntensity());
    }

    private String normalizeMemo(String memo) {
        if (memo == null) {
            return null;
        }
        String trimmed = memo.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean equalsNullable(String a, String b) {
        if (a == null) {
            return b == null;
        }
        return a.equals(b);
    }

    private String joinTypes(List<String> types) {
        if (types == null || types.isEmpty()) {
            return null;
        }
        return String.join(",", types);
    }

    private int calculatePointsEarned(User user, LocalDate date, AttendanceInput input, String memo) {
        int points = 0;
        points += 5;
        points += input.workoutTypes().size();

        if (input.workoutIntensity() != null) {
            points += INTENSITY_POINTS.getOrDefault(input.workoutIntensity(), 0);
        }

        String normalizedMemo = normalizeMemo(memo);
        if (normalizedMemo != null) {
            points += 1;
            points += countKeywordBonus(normalizedMemo);
        }

        int streak = calculateStreakForDate(user, date);
        points += streakBonus(streak);
        return points;
    }

    private int countKeywordBonus(String memo) {
        int bonus = 0;
        for (String keyword : MEMO_KEYWORDS) {
            if (memo.contains(keyword)) {
                bonus += 1;
            }
        }
        return Math.min(bonus, 3);
    }

    private int streakBonus(int streak) {
        if (streak >= 30) {
            return 6;
        }
        if (streak >= 14) {
            return 4;
        }
        if (streak >= 7) {
            return 3;
        }
        if (streak >= 3) {
            return 2;
        }
        return 0;
    }

    private int calculateStreakForDate(User user, LocalDate date) {
        AttendanceLog dateLog = attendanceLogRepository.findByUserAndDate(user, date).orElse(null);
        if (dateLog != null && !dateLog.isDidWorkout()) {
            return 0;
        }

        LocalDate cursor = (dateLog != null) ? date : date.minusDays(1);
        int streak = 0;
        while (true) {
            AttendanceLog log = attendanceLogRepository.findByUserAndDate(user, cursor).orElse(null);
            if (log == null || !log.isDidWorkout()) {
                break;
            }
            streak += 1;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private User getUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    private record AttendanceInput(
            boolean didWorkout,
            List<String> workoutTypes,
            String workoutIntensity,
            String workoutTypesCsv
    ) {}

    private record UpsertResult(
            AttendanceLog log,
            boolean previousDidWorkout,
            boolean currentDidWorkout,
            int pointsEarned
    ) {}
}
