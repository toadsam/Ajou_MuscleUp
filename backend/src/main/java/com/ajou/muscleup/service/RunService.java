package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.entity.RunSession;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.RunSessionRepository;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 러닝 기록(나이키 런클럽처럼). 화면이 GPS 로 거리 · 시간 · 1km 구간을 재고, 끝낼 때 결과만 한 번에 보낸다(경로는 휴대폰에만).
 * - 기록: 가장 긴 거리(1km 이상), 가장 빠른 1km · 5km · 10km(연속 구간 합, GPS 로 잰 것만). 깨면 활동 점수 +5, 하루 2개까지.
 * - 러닝머신 등 직접 입력(MANUAL)은 구간이 없어 속도 기록은 비교하지 않고 거리 기록만.
 * - 원하면 오늘 출석도 함께(아직 안 했을 때만, 유산소로).
 * - 차 · 자전거로 잰 기록을 막으려고 평균 페이스가 1km 2분 30초보다 빠르면 거절한다(세계 기록도 2분 40초대).
 */
@Service
@RequiredArgsConstructor
public class RunService {
    public static final int RECORD_POINTS = 5;
    static final int RECORD_POINTS_PER_DAY = 10;
    static final int MAX_RUNS_PER_DAY = 10;
    static final int MIN_DISTANCE_M = 100;
    static final int MAX_DISTANCE_M = 100_000;
    static final int MIN_PACE_SEC = 150; // 1km 2:30
    static final int MAX_SPLIT_SEC = 3600;
    static final Duration MIN_DURATION = Duration.ofMinutes(1);
    static final Duration MAX_DURATION = Duration.ofHours(12);
    static final Duration CLOCK_SKEW = Duration.ofMinutes(5);
    static final int DISTANCE_RECORD_MIN_M = 1000;

    public static final String GPS = "GPS";
    public static final String MANUAL = "MANUAL";

    private final RunSessionRepository runRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final AttendanceService attendanceService;
    private final CharacterGrowthService characterGrowthService;
    private final Clock clock;

    /** startedAt · endedAt: 시간대가 붙은 시각. durationSec: 멈춘 시간을 뺀 달린 시간. splits: 1km 마다 걸린 초(GPS 만) */
    public record SaveRequest(OffsetDateTime startedAt, OffsetDateTime endedAt, Integer durationSec, Integer distanceM,
                              List<Integer> splits, String source, Boolean checkAttendance, String note) {}

    public record RunView(Long id, LocalDate date, LocalDateTime startedAt, int durationSec, int distanceM, Integer paceSec,
                          List<Integer> splits, String source, Integer best1kSec, Integer best5kSec, Integer best10kSec,
                          String note) {
        static RunView from(RunSession r) {
            return new RunView(r.getId(), r.getPerformedOn(), r.getStartedAt(), r.getDurationSec(), r.getDistanceM(),
                    pace(r.getDurationSec(), r.getDistanceM()), parseSplits(r.getSplits()), r.getSource(),
                    r.getBest1kSec(), r.getBest5kSec(), r.getBest10kSec(), r.getNote());
        }
    }

    /** type: DISTANCE(미터) · K1 · K5 · K10(초). previous 가 null 이면 첫 기록 */
    public record Record(String type, String label, Integer previous, int value) {}

    public record AttendanceResult(boolean created, Integer expEarned, Integer weeklyGoalBonus) {}

    public record SaveResult(RunView run, List<Record> records, int points, AttendanceResult attendance) {}

    public record Records(Integer longestM, Integer best1kSec, Integer best5kSec, Integer best10kSec,
                          int weekDistanceM, int weekRuns, int monthDistanceM, int monthRuns, int totalDistanceM) {}

    @Transactional
    public SaveResult save(User me, String email, SaveRequest req) {
        if (req == null || req.startedAt() == null || req.endedAt() == null) {
            throw bad("러닝 시작 · 끝 시각이 필요해요.");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime startedAt = req.startedAt().atZoneSameInstant(clock.getZone()).toLocalDateTime();
        LocalDateTime endedAt = req.endedAt().atZoneSameInstant(clock.getZone()).toLocalDateTime();
        if (endedAt.isAfter(now.plus(CLOCK_SKEW)) || startedAt.isBefore(now.minusDays(1)) || endedAt.isBefore(startedAt)) {
            throw bad("러닝 시각이 맞지 않아요. 휴대폰 시계를 확인해 주세요.");
        }
        long elapsed = Duration.between(startedAt, endedAt).getSeconds();
        int duration = req.durationSec() == null ? (int) elapsed : req.durationSec();
        if (duration < MIN_DURATION.getSeconds() || duration > MAX_DURATION.getSeconds()) {
            throw bad("러닝 시간은 1분 ~ 12시간 사이만 저장할 수 있어요.");
        }
        if (duration > elapsed + 5) {
            throw bad("달린 시간이 시작 ~ 끝 시간보다 길어요.");
        }
        int distance = req.distanceM() == null ? 0 : req.distanceM();
        if (distance < MIN_DISTANCE_M || distance > MAX_DISTANCE_M) {
            throw bad("거리는 0.1km ~ 100km 사이만 저장할 수 있어요.");
        }
        if ((long) duration * 1000 / distance < MIN_PACE_SEC) {
            throw bad("너무 빨라요. 차나 자전거로 움직인 기록은 저장할 수 없어요.");
        }
        String source = MANUAL.equalsIgnoreCase(req.source()) ? MANUAL : GPS;
        List<Integer> splits = req.splits() == null ? List.of() : req.splits();
        if (MANUAL.equals(source)) {
            splits = List.of();
        } else {
            // 구간이 없으면(GPS 가 흔들려 화면이 버린 경우) 속도 기록만 빼고 받는다
            int fullKm = distance / 1000;
            if (!splits.isEmpty() && (splits.size() > fullKm || splits.size() < fullKm - 1)) {
                throw bad("구간 기록이 거리와 맞지 않아요.");
            }
            int sum = 0;
            for (Integer s : splits) {
                if (s == null || s < MIN_PACE_SEC || s > MAX_SPLIT_SEC) {
                    throw bad("구간 기록이 맞지 않아요(1km 2분 30초 ~ 1시간).");
                }
                sum += s;
            }
            if (sum > duration + 5) {
                throw bad("구간 기록이 달린 시간보다 길어요.");
            }
        }
        LocalDate date = startedAt.toLocalDate();
        if (runRepository.countByUser_IdAndPerformedOn(me.getId(), date) >= MAX_RUNS_PER_DAY) {
            throw bad("하루에 " + MAX_RUNS_PER_DAY + "번까지 저장할 수 있어요.");
        }

        RunSession run = runRepository.save(RunSession.builder().user(me).performedOn(date).startedAt(startedAt).endedAt(endedAt)
                .durationSec(duration).distanceM(distance).source(source)
                .splits(splits.isEmpty() ? null : splits.stream().map(String::valueOf).collect(Collectors.joining(",")))
                .best1kSec(bestWindow(splits, 1)).best5kSec(bestWindow(splits, 5)).best10kSec(bestWindow(splits, 10))
                .note(trimNote(req.note())).build());

        // 기록 비교(이번 러닝 빼고)
        List<RunSession> others = runRepository.findAllByUserExcept(me.getId(), run.getId());
        List<Record> records = new ArrayList<>();
        if (distance >= DISTANCE_RECORD_MIN_M) {
            Integer prev = others.stream().map(RunSession::getDistanceM).max(Integer::compare).orElse(null);
            if (prev == null || distance > prev) records.add(new Record("DISTANCE", "가장 긴 거리", prev, distance));
        }
        addPaceRecord(records, "K1", "가장 빠른 1km", run.getBest1kSec(), others.stream().map(RunSession::getBest1kSec));
        addPaceRecord(records, "K5", "가장 빠른 5km", run.getBest5kSec(), others.stream().map(RunSession::getBest5kSec));
        addPaceRecord(records, "K10", "가장 빠른 10km", run.getBest10kSec(), others.stream().map(RunSession::getBest10kSec));

        int earnedToday = others.stream().filter(r -> r.getPerformedOn().equals(date)).mapToInt(RunSession::getRecordPoints).sum();
        int points = Math.max(0, Math.min(records.size() * RECORD_POINTS, RECORD_POINTS_PER_DAY - earnedToday));
        if (points > 0) {
            run.setRecordPoints(points);
            characterGrowthService.applyAttendance(me, points);
        }

        AttendanceResult attendance = new AttendanceResult(false, null, null);
        if (Boolean.TRUE.equals(req.checkAttendance()) && date.equals(LocalDate.now(clock))
                && attendanceLogRepository.findByUserAndDate(me, date).isEmpty()) {
            AttendanceLogResponse a = attendanceService.upsertToday(email,
                    AttendanceUpsertRequest.workout(List.of("cardio"), runMemo(run)));
            attendance = new AttendanceResult(true, a.getExpEarned(), a.getWeeklyGoalBonus());
        }
        return new SaveResult(RunView.from(run), records, points, attendance);
    }

    @Transactional(readOnly = true)
    public List<RunView> list(User me, YearMonth month) {
        YearMonth m = month == null ? YearMonth.now(clock) : month;
        return runRepository.findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(me.getId(), m.atDay(1), m.atEndOfMonth())
                .stream().map(RunView::from).toList();
    }

    @Transactional(readOnly = true)
    public RunView get(User me, Long id) {
        return RunView.from(mine(me, id));
    }

    @Transactional
    public void delete(User me, Long id) {
        runRepository.delete(mine(me, id));
    }

    @Transactional(readOnly = true)
    public Records records(User me) {
        List<RunSession> all = runRepository.findAllByUser_Id(me.getId());
        LocalDate today = LocalDate.now(clock);
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        YearMonth month = YearMonth.from(today);
        int weekM = 0, weekRuns = 0, monthM = 0, monthRuns = 0, total = 0;
        for (RunSession r : all) {
            total += r.getDistanceM();
            if (!r.getPerformedOn().isBefore(weekStart)) {
                weekM += r.getDistanceM();
                weekRuns++;
            }
            if (YearMonth.from(r.getPerformedOn()).equals(month)) {
                monthM += r.getDistanceM();
                monthRuns++;
            }
        }
        Integer longest = all.stream().map(RunSession::getDistanceM).filter(d -> d >= DISTANCE_RECORD_MIN_M)
                .max(Integer::compare).orElse(null);
        return new Records(longest,
                all.stream().map(RunSession::getBest1kSec).filter(Objects::nonNull).min(Integer::compare).orElse(null),
                all.stream().map(RunSession::getBest5kSec).filter(Objects::nonNull).min(Integer::compare).orElse(null),
                all.stream().map(RunSession::getBest10kSec).filter(Objects::nonNull).min(Integer::compare).orElse(null),
                weekM, weekRuns, monthM, monthRuns, total);
    }

    /** 연속한 n 개 구간 합의 최솟값(구간이 모자라면 null) */
    static Integer bestWindow(List<Integer> splits, int n) {
        if (splits.size() < n) return null;
        int sum = 0;
        for (int i = 0; i < n; i++) sum += splits.get(i);
        int best = sum;
        for (int i = n; i < splits.size(); i++) {
            sum += splits.get(i) - splits.get(i - n);
            best = Math.min(best, sum);
        }
        return best;
    }

    private static void addPaceRecord(List<Record> out, String type, String label, Integer value,
                                      java.util.stream.Stream<Integer> others) {
        if (value == null) return;
        Integer prev = others.filter(Objects::nonNull).min(Integer::compare).orElse(null);
        if (prev == null || value < prev) out.add(new Record(type, label, prev, value));
    }

    static Integer pace(int durationSec, int distanceM) {
        return distanceM <= 0 ? null : (int) Math.round(durationSec * 1000.0 / distanceM);
    }

    static List<Integer> parseSplits(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isEmpty()).map(Integer::valueOf).toList();
    }

    /** 출석 메모: "러닝 5.21km · 28분 · 1km 5'24\"" */
    private static String runMemo(RunSession r) {
        String km = String.format("%.2f", r.getDistanceM() / 1000.0);
        Integer p = pace(r.getDurationSec(), r.getDistanceM());
        String memo = "러닝 " + km + "km · " + Math.max(1, r.getDurationSec() / 60) + "분";
        if (p != null) memo += " · 1km " + (p / 60) + "'" + String.format("%02d", p % 60) + "\"";
        return memo;
    }

    private RunSession mine(User me, Long id) {
        return runRepository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "러닝 기록을 찾을 수 없어요."));
    }

    private static String trimNote(String note) {
        if (note == null || note.isBlank()) return null;
        String t = note.strip();
        return t.length() > 200 ? t.substring(0, 200) : t;
    }

    private static ResponseStatusException bad(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }
}
