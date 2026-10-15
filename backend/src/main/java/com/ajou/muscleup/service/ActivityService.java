package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.entity.ActivityLog;
import com.ajou.muscleup.entity.CustomActivity;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.ActivityLogRepository;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.CustomActivityRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 내가 추가한 운동(필라테스 · 수영 등) — 헬스(세트 · 무게) · 러닝(GPS)과 달리 시간 + 메모만 기록한다.
 * - 종류는 한 사람에 MAX_ACTIVITIES 개까지, 이름은 20자까지. 지우면 고르기에서만 빠진다(지난 기록 이름 유지).
 * - 기록: 운동한 시간(1분 ~ 12시간) + 끝난 시각(없으면 지금, 하루 안). 원하면 오늘 출석도 함께(아직 안 했을 때만).
 */
@Service
@RequiredArgsConstructor
public class ActivityService {
    static final int MAX_ACTIVITIES = 12;
    static final int MAX_NAME = 20;
    static final int MAX_LOGS_PER_DAY = 10;
    static final Duration MIN_DURATION = Duration.ofMinutes(1);
    static final Duration MAX_DURATION = Duration.ofHours(12);
    static final Duration CLOCK_SKEW = Duration.ofMinutes(5);
    /** 종류 → 출석 운동 종류(AttendanceServiceImpl.ALLOWED_TYPES) */
    static final Map<String, String> CATEGORIES = Map.of("WEIGHT", "weight", "CARDIO", "cardio", "STRETCH", "stretch");

    private final CustomActivityRepository activityRepository;
    private final ActivityLogRepository logRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final AttendanceService attendanceService;
    private final Clock clock;

    public record ActivityView(Long id, String name, String category) {
        static ActivityView from(CustomActivity a) {
            return new ActivityView(a.getId(), a.getName(), a.getCategory());
        }
    }

    public record AddRequest(String name, String category) {}

    /** durationSec: 운동한 시간. endedAt: 끝난 시각(없으면 지금) */
    public record LogRequest(Integer durationSec, OffsetDateTime endedAt, String note, Boolean checkAttendance) {}

    public record LogView(Long id, Long activityId, String name, LocalDate date, LocalDateTime startedAt, int durationSec, String note) {
        static LogView from(ActivityLog l) {
            return new LogView(l.getId(), l.getActivity().getId(), l.getActivity().getName(), l.getPerformedOn(),
                    l.getStartedAt(), l.getDurationSec(), l.getNote());
        }
    }

    /** rewardBox: 이 출석으로 받은 보상 상자(WEEKLY_GOAL · LUCKY · null) */
    public record AttendanceResult(boolean created, Integer expEarned, Integer weeklyGoalBonus, String rewardBox) {}

    public record LogResult(LogView log, AttendanceResult attendance) {}

    @Transactional(readOnly = true)
    public List<ActivityView> list(User me) {
        return activityRepository.findAllByUser_IdAndDeletedFalseOrderByIdAsc(me.getId()).stream().map(ActivityView::from).toList();
    }

    @Transactional
    public ActivityView add(User me, AddRequest req) {
        String name = req == null || req.name() == null ? "" : req.name().strip().replaceAll("\\s+", " ");
        if (name.isEmpty() || name.length() > MAX_NAME) {
            throw bad("운동 이름은 1 ~ " + MAX_NAME + "자로 적어 주세요.");
        }
        String category = req.category() == null ? "CARDIO" : req.category().toUpperCase();
        if (!CATEGORIES.containsKey(category)) {
            throw bad("종류는 근력 · 유산소 · 스트레칭 중에서 골라 주세요.");
        }
        if (activityRepository.existsByUser_IdAndNameAndDeletedFalse(me.getId(), name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 있는 운동이에요.");
        }
        if (activityRepository.countByUser_IdAndDeletedFalse(me.getId()) >= MAX_ACTIVITIES) {
            throw bad("운동은 " + MAX_ACTIVITIES + "개까지 추가할 수 있어요.");
        }
        return ActivityView.from(activityRepository.save(CustomActivity.builder().user(me).name(name).category(category).build()));
    }

    @Transactional
    public void remove(User me, Long id) {
        mine(me, id).setDeleted(true);
    }

    @Transactional
    public LogResult log(User me, String email, Long activityId, LogRequest req) {
        CustomActivity activity = mine(me, activityId);
        if (activity.isDeleted()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "운동을 찾을 수 없어요.");
        int duration = req == null || req.durationSec() == null ? 0 : req.durationSec();
        if (duration < MIN_DURATION.getSeconds() || duration > MAX_DURATION.getSeconds()) {
            throw bad("운동 시간은 1분 ~ 12시간 사이만 저장할 수 있어요.");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime endedAt = req.endedAt() == null ? now : req.endedAt().atZoneSameInstant(clock.getZone()).toLocalDateTime();
        if (endedAt.isAfter(now.plus(CLOCK_SKEW)) || endedAt.isBefore(now.minusDays(1))) {
            throw bad("운동 시각이 맞지 않아요. 휴대폰 시계를 확인해 주세요.");
        }
        LocalDateTime startedAt = endedAt.minusSeconds(duration);
        LocalDate date = startedAt.toLocalDate();
        if (logRepository.countByUser_IdAndPerformedOn(me.getId(), date) >= MAX_LOGS_PER_DAY) {
            throw bad("하루에 " + MAX_LOGS_PER_DAY + "번까지 저장할 수 있어요.");
        }
        ActivityLog saved = logRepository.save(ActivityLog.builder().user(me).activity(activity).performedOn(date)
                .startedAt(startedAt).durationSec(duration).note(trimNote(req.note())).build());

        AttendanceResult attendance = new AttendanceResult(false, null, null, null);
        if (Boolean.TRUE.equals(req.checkAttendance()) && date.equals(LocalDate.now(clock))
                && attendanceLogRepository.findByUserAndDate(me, date).isEmpty()) {
            String memo = activity.getName() + " " + Math.max(1, duration / 60) + "분";
            AttendanceLogResponse a = attendanceService.upsertToday(email,
                    AttendanceUpsertRequest.workout(List.of(CATEGORIES.get(activity.getCategory())), memo));
            attendance = new AttendanceResult(true, a.getExpEarned(), a.getWeeklyGoalBonus(), a.getRewardBox());
        }
        return new LogResult(LogView.from(saved), attendance);
    }

    @Transactional(readOnly = true)
    public List<LogView> logs(User me, YearMonth month) {
        YearMonth m = month == null ? YearMonth.now(clock) : month;
        return logRepository.findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(me.getId(), m.atDay(1), m.atEndOfMonth())
                .stream().map(LogView::from).toList();
    }

    @Transactional
    public void deleteLog(User me, Long id) {
        logRepository.delete(logRepository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록을 찾을 수 없어요.")));
    }

    private CustomActivity mine(User me, Long id) {
        return activityRepository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "운동을 찾을 수 없어요."));
    }

    private static String trimNote(String note) {
        if (note == null || note.isBlank()) return null;
        String t = note.strip();
        return t.length() > 200 ? t.substring(0, 200) : t;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
