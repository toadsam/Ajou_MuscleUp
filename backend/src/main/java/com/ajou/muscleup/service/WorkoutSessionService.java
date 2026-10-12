package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutSession;
import com.ajou.muscleup.entity.WorkoutSet;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.LiftEntryRepository;
import com.ajou.muscleup.repository.WorkoutSessionRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
 * 운동 세션(번핏처럼: 시작 → 종목 · 세트 체크 · 휴식 타이머 → 끝). 진행 중 상태는 화면이 들고 있고 끝낼 때 한 번에 저장한다.
 * - 끝낼 때 무게가 있는 종목마다 가장 좋은 세트(추정 1RM)로 운동 기록(LiftService.record)을 하나 만든다 → 개인 최고 · 3대 · 점수가 PR F 와 똑같이.
 * - 원하면 오늘 출석도 함께(아직 안 했을 때만, 웨이트로) — 출석 점수 · 주간 목표 · 오늘 할 일이 그대로 붙는다.
 * - 세션을 지우면 그 세션이 만든 운동 기록도 지운다(3대 기록은 내려가지 않음 — PR F 와 같음).
 */
@Service
@RequiredArgsConstructor
public class WorkoutSessionService {
    static final int MAX_EXERCISES = 20;
    static final int MAX_SETS_PER_EXERCISE = 30;
    static final int MAX_SESSIONS_PER_DAY = 10;
    static final Duration MIN_DURATION = Duration.ofMinutes(1);
    static final Duration MAX_DURATION = Duration.ofHours(6);
    /** 화면 시계와 서버 시계가 조금 달라도 받는다 */
    static final Duration CLOCK_SKEW = Duration.ofMinutes(5);

    private final WorkoutSessionRepository sessionRepository;
    private final LiftEntryRepository liftRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final LiftService liftService;
    private final AttendanceService attendanceService;
    private final Clock clock;

    public record SetRequest(Double weightKg, Integer reps) {}

    public record ExerciseRequest(String exercise, List<SetRequest> sets) {}

    /** startedAt · endedAt: 시간대가 붙은 시각(화면의 toISOString). 저장은 한국 시간으로 바꿔서 */
    public record SaveRequest(OffsetDateTime startedAt, OffsetDateTime endedAt, List<ExerciseRequest> exercises,
                              Boolean checkAttendance, String note) {}

    public record SetView(double weightKg, int reps) {}

    public record ExerciseView(String exercise, String label, boolean bodyweight, List<SetView> sets, double volume) {}

    public record Summary(Long id, LocalDate date, LocalDateTime startedAt, int durationSec, double totalVolume, int totalSets,
                          List<String> exercises) {}

    public record Detail(Summary summary, List<ExerciseView> exercises, String note) {}

    /** 출석을 새로 했으면 그 결과(점수 · 주간 목표 보너스) */
    /** rewardBox: 이 출석으로 받은 보상 상자(WEEKLY_GOAL · LUCKY · null) */
    public record AttendanceResult(boolean created, Integer expEarned, Integer weeklyGoalBonus, String rewardBox) {}

    public record SaveResult(Detail session, List<LiftService.Pr> prs, List<LiftService.StatUpdate> statUpdates, int points,
                             AttendanceResult attendance) {}

    public record Previous(LocalDate date, List<SetView> sets) {}

    @Transactional
    public SaveResult save(User me, String email, SaveRequest req) {
        if (req == null || req.startedAt() == null || req.endedAt() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "운동 시작 · 끝 시각이 필요해요.");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime startedAt = req.startedAt().atZoneSameInstant(clock.getZone()).toLocalDateTime();
        LocalDateTime endedAt = req.endedAt().atZoneSameInstant(clock.getZone()).toLocalDateTime();
        Duration duration = Duration.between(startedAt, endedAt);
        if (endedAt.isAfter(now.plus(CLOCK_SKEW)) || startedAt.isBefore(now.minusDays(1))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "운동 시각이 맞지 않아요. 휴대폰 시계를 확인해 주세요.");
        }
        if (duration.compareTo(MIN_DURATION) < 0 || duration.compareTo(MAX_DURATION) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "운동 시간은 1분 ~ 6시간 사이만 저장할 수 있어요.");
        }
        List<ExerciseRequest> exercises = req.exercises() == null ? List.of() : req.exercises();
        if (exercises.size() > MAX_EXERCISES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "한 번에 " + MAX_EXERCISES + "종목까지 저장할 수 있어요.");
        }
        LocalDate date = startedAt.toLocalDate();
        if (sessionRepository.countByUser_IdAndPerformedOn(me.getId(), date) >= MAX_SESSIONS_PER_DAY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "하루에 " + MAX_SESSIONS_PER_DAY + "번까지 저장할 수 있어요.");
        }

        WorkoutSession session = WorkoutSession.builder().user(me).performedOn(date).startedAt(startedAt).endedAt(endedAt)
                .durationSec((int) duration.getSeconds()).note(trimNote(req.note())).build();
        double totalVolume = 0;
        int totalSets = 0;
        // 종목마다 가장 좋은 세트(추정 1RM) — 운동 기록 · 개인 최고용
        Map<LiftExercise, double[]> best = new LinkedHashMap<>(); // [무게, 횟수, 세트 수]
        for (int i = 0; i < exercises.size(); i++) {
            ExerciseRequest er = exercises.get(i);
            LiftExercise ex = LiftExercise.parse(er == null ? null : er.exercise());
            if (ex == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종목을 알 수 없어요.");
            }
            List<SetRequest> sets = er.sets() == null ? List.of() : er.sets();
            if (sets.size() > MAX_SETS_PER_EXERCISE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "한 종목에 " + MAX_SETS_PER_EXERCISE + "세트까지 저장할 수 있어요.");
            }
            for (int j = 0; j < sets.size(); j++) {
                SetRequest sr = sets.get(j);
                double w = sr == null || sr.weightKg() == null ? 0 : Math.round(sr.weightKg() * 4) / 4.0;
                int r = sr == null || sr.reps() == null ? 0 : sr.reps();
                if (w < 0 || w > 500 || (!ex.bodyweight && w <= 0)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.label + " 무게를 확인해 주세요(0.5~500kg).");
                }
                if (r < 1 || r > 100) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.label + " 횟수를 확인해 주세요(1~100회).");
                }
                session.getSets().add(WorkoutSet.builder().session(session).exercise(ex.name()).exerciseOrder(i).setOrder(j)
                        .weightKg(w).reps(r).build());
                totalVolume += w * r;
                totalSets++;
                if (!ex.bodyweight && r <= 30) {
                    double[] b = best.get(ex);
                    if (b == null) {
                        best.put(ex, new double[] {w, r, 1});
                    } else {
                        b[2]++;
                        if (LiftService.estimate1rm(w, r) > LiftService.estimate1rm(b[0], (int) b[1])) {
                            b[0] = w;
                            b[1] = r;
                        }
                    }
                }
            }
        }
        if (totalSets == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "끝낸 세트가 하나도 없어요.");
        }
        session.setTotalVolume(Math.round(totalVolume * 10) / 10.0);
        session.setTotalSets(totalSets);
        WorkoutSession saved = sessionRepository.save(session);

        List<LiftService.Pr> prs = new ArrayList<>();
        List<LiftService.StatUpdate> statUpdates = new ArrayList<>();
        int points = 0;
        for (Map.Entry<LiftExercise, double[]> e : best.entrySet()) {
            double[] b = e.getValue();
            LiftService.SaveResult r = liftService.record(me, e.getKey(), date, b[0], (int) b[1], (int) b[2], saved.getId());
            if (r.pr() != null) prs.add(r.pr());
            if (r.statUpdate() != null) statUpdates.add(r.statUpdate());
            points += r.points();
        }

        AttendanceResult attendance = new AttendanceResult(false, null, null, null);
        if (Boolean.TRUE.equals(req.checkAttendance()) && date.equals(LocalDate.now(clock))
                && attendanceLogRepository.findByUserAndDate(me, date).isEmpty()) {
            AttendanceLogResponse a = attendanceService.upsertToday(email,
                    AttendanceUpsertRequest.workout(List.of("weight"), sessionMemo(saved)));
            attendance = new AttendanceResult(true, a.getExpEarned(), a.getWeeklyGoalBonus(), a.getRewardBox());
        }
        return new SaveResult(detail(saved), prs, statUpdates, points, attendance);
    }

    @Transactional(readOnly = true)
    public List<Summary> list(User me, YearMonth month) {
        YearMonth m = month == null ? YearMonth.now(clock) : month;
        return sessionRepository.findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(me.getId(), m.atDay(1), m.atEndOfMonth())
                .stream().map(WorkoutSessionService::summary).toList();
    }

    @Transactional(readOnly = true)
    public Detail get(User me, Long id) {
        return detail(mine(me, id));
    }

    @Transactional
    public void delete(User me, Long id) {
        WorkoutSession s = mine(me, id);
        liftRepository.deleteBySessionId(s.getId());
        sessionRepository.delete(s);
    }

    /** 이 종목을 한 가장 최근 세션의 세트들(없으면 null) — 화면이 "지난번" 값으로 미리 채운다 */
    @Transactional(readOnly = true)
    public Previous previous(User me, String exercise) {
        LiftExercise ex = LiftExercise.parse(exercise);
        if (ex == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "종목을 알 수 없어요.");
        }
        List<WorkoutSession> recent = sessionRepository.findRecentWithExercise(me.getId(), ex.name(), PageRequest.of(0, 1));
        if (recent.isEmpty()) {
            return null;
        }
        WorkoutSession s = recent.get(0);
        List<SetView> sets = s.getSets().stream().filter(x -> x.getExercise().equals(ex.name()))
                .map(x -> new SetView(x.getWeightKg(), x.getReps())).toList();
        return new Previous(s.getPerformedOn(), sets);
    }

    private WorkoutSession mine(User me, Long id) {
        return sessionRepository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "운동 기록을 찾을 수 없어요."));
    }

    private static Summary summary(WorkoutSession s) {
        Set<String> labels = new LinkedHashSet<>();
        for (WorkoutSet x : s.getSets()) {
            LiftExercise ex = LiftExercise.parse(x.getExercise());
            labels.add(ex == null ? x.getExercise() : ex.label);
        }
        return new Summary(s.getId(), s.getPerformedOn(), s.getStartedAt(), s.getDurationSec(), s.getTotalVolume(), s.getTotalSets(),
                List.copyOf(labels));
    }

    private static Detail detail(WorkoutSession s) {
        Map<String, List<SetView>> byExercise = new LinkedHashMap<>();
        for (WorkoutSet x : s.getSets()) {
            byExercise.computeIfAbsent(x.getExercise(), k -> new ArrayList<>()).add(new SetView(x.getWeightKg(), x.getReps()));
        }
        List<ExerciseView> views = new ArrayList<>();
        for (Map.Entry<String, List<SetView>> e : byExercise.entrySet()) {
            LiftExercise ex = LiftExercise.parse(e.getKey());
            double volume = e.getValue().stream().mapToDouble(v -> v.weightKg() * v.reps()).sum();
            views.add(new ExerciseView(e.getKey(), ex == null ? e.getKey() : ex.label, ex != null && ex.bodyweight, e.getValue(),
                    Math.round(volume * 10) / 10.0));
        }
        return new Detail(summary(s), views, s.getNote());
    }

    /** 출석 메모(200자): "운동 52분 · 스쿼트, 벤치프레스 외 2" */
    private static String sessionMemo(WorkoutSession s) {
        List<String> labels = summary(s).exercises();
        String names = labels.size() <= 2 ? String.join(", ", labels)
                : String.join(", ", labels.subList(0, 2)) + " 외 " + (labels.size() - 2);
        String memo = "운동 " + Math.max(1, s.getDurationSec() / 60) + "분 · " + names;
        return memo.length() > 200 ? memo.substring(0, 200) : memo;
    }

    private static String trimNote(String note) {
        if (note == null || note.isBlank()) return null;
        String t = note.strip();
        return t.length() > 200 ? t.substring(0, 200) : t;
    }
}
