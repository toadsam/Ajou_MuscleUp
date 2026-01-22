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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

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
        CharacterChangeResponse change =
                characterGrowthService.applyAttendance(user, result.previousDidWorkout, result.currentDidWorkout);
        return AttendanceLogResponse.from(result.log, eventProgress, change);
    }

    @Override
    @Transactional
    public AttendanceLogResponse upsertByDate(String email, LocalDate date, AttendanceUpsertRequest request) {
        User user = getUserOrThrow(email);
        UpsertResult result = upsert(user, date, request);
        List<EventProgressResponse> eventProgress =
                eventService.updateAttendanceProgress(user, date, result.previousDidWorkout, result.currentDidWorkout);
        CharacterChangeResponse change =
                characterGrowthService.applyAttendance(user, result.previousDidWorkout, result.currentDidWorkout);
        return AttendanceLogResponse.from(result.log, eventProgress, change);
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
        AttendanceLog log = attendanceLogRepository.findByUserAndDate(user, date)
                .orElseGet(() -> AttendanceLog.builder()
                        .user(user)
                        .date(date)
                        .build());
        boolean previousDidWorkout = log.isDidWorkout();
        boolean currentDidWorkout = Boolean.TRUE.equals(request.getDidWorkout());
        log.setDidWorkout(currentDidWorkout);
        log.setMemo(request.getMemo());
        AttendanceLog saved = attendanceLogRepository.save(log);
        return new UpsertResult(saved, previousDidWorkout, currentDidWorkout);
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

    private User getUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    private record UpsertResult(AttendanceLog log, boolean previousDidWorkout, boolean currentDidWorkout) {}
}
