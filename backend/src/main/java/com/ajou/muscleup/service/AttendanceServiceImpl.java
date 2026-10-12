package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AdminAttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendancePublicShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceRankingItemResponse;
import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.AttendanceShareReport;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.AttendanceShareReportRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AttendanceServiceImpl implements AttendanceService {
    /** 연속 출석을 셀 때 한 번에 읽는 날짜 폭. 연속이 이보다 길면 다음 구간을 이어서 읽는다. */
    private static final int STREAK_WINDOW_DAYS = 120;
    /** 주간 연속 출석 랭킹은 출석 화면을 열 때마다 불린다. 결과를 잠깐 들고 있는다. */
    private static final Duration WEEKLY_STREAK_CACHE_TTL = Duration.ofMinutes(2);
    private static final int RANKING_MAX_LIMIT = 50;
    private static final List<String> ALLOWED_TYPES = List.of("weight", "cardio", "stretch");
    private static final Set<String> ALLOWED_INTENSITIES = Set.of("light", "normal", "hard");
    private static final Map<String, Integer> INTENSITY_POINTS = Map.of(
            "light", 1,
            "normal", 2,
            "hard", 3
    );
    private static final List<String> MEMO_KEYWORDS = List.of("PR", "deadlift", "squat", "bench", "record");

    private final AttendanceLogRepository attendanceLogRepository;
    private final UserRepository userRepository;
    private final EventService eventService;
    private final CharacterGrowthService characterGrowthService;
    private final WeeklyGoalService weeklyGoalService;
    private final CollectionService collectionService;
    private final AttendanceShareReportRepository shareReportRepository;
    private final AttendanceCheerGuard cheerGuard;
    private final PlatformTransactionManager transactionManager;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    private volatile WeeklyStreakSnapshot weeklyStreakSnapshot;

    /**
     * 새 출석은 여기(한국 시간 "오늘")에서만 만든다. 포인트·연속 보너스도 이 경로에서만 붙는다.
     */
    @Override
    public AttendanceLogResponse upsertToday(String email, AttendanceUpsertRequest request) {
        LocalDate today = LocalDate.now(clock);
        return upsertWithRetry(() -> doUpsert(email, today, request, true));
    }

    /**
     * 날짜 지정 수정. 예전에는 아무 날짜(과거·미래)나 새로 만들어져 포인트·연속 보너스·이벤트 진행도가 쌓였다.
     * - 미래 날짜: 400
     * - 어제보다 이전: 400 (오늘·어제 기록만 고칠 수 있다)
     * - 어제: 이미 있는 기록만 고칠 수 있다(없으면 404). 수정은 포인트를 주지 않는다.
     * - 오늘: 기록이 없으면 POST /today 와 같은 "오늘 출석"으로 처리한다(화면이 늦게 갱신된 경우 대비).
     */
    @Override
    public AttendanceLogResponse upsertByDate(String email, LocalDate date, AttendanceUpsertRequest request) {
        LocalDate today = LocalDate.now(clock);
        if (date.isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "미래 날짜에는 출석을 기록할 수 없어요.");
        }
        if (date.isBefore(today.minusDays(1))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "출석 기록은 오늘과 어제 것만 고칠 수 있어요.");
        }
        boolean allowCreate = date.equals(today);
        return upsertWithRetry(() -> doUpsert(email, date, request, allowCreate));
    }

    /**
     * 같은 사람이 같은 날 출석을 거의 동시에 두 번 보내면 (user_id, workout_date) UNIQUE 에 걸려 500 이 났다.
     * 먼저 들어간 기록이 이미 커밋돼 있으니 한 번 더 돌리면 "같은 내용"(포인트 0) 또는 "수정" 경로로 처리된다.
     * 그래도 겹치면 409.
     */
    private AttendanceLogResponse upsertWithRetry(Supplier<AttendanceLogResponse> work) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        AttendanceLogResponse response;
        try {
            response = tx.execute(status -> work.get());
        } catch (DataIntegrityViolationException first) {
            try {
                response = tx.execute(status -> work.get());
            } catch (DataIntegrityViolationException second) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "같은 날 출석이 동시에 저장되고 있어요. 잠시 후 다시 시도해 주세요.");
            }
        }
        weeklyStreakSnapshot = null; // 출석이 바뀌었으니 주간 랭킹 캐시를 비운다.
        return response;
    }

    private AttendanceLogResponse doUpsert(String email, LocalDate date, AttendanceUpsertRequest request, boolean allowCreate) {
        User user = getUserOrThrow(email);
        UpsertResult result = upsert(user, date, request, allowCreate);
        List<EventProgressResponse> eventProgress =
                eventService.updateAttendanceProgress(user, date, result.previousDidWorkout, result.currentDidWorkout);
        // 이번 출석으로 주간 목표를 처음 채웠으면 보너스를 같은 점수에 더한다(한 주에 한 번)
        WeeklyGoalService.Reward weekly = result.currentDidWorkout && !result.previousDidWorkout
                ? weeklyGoalService.onWorkoutAdded(user, date)
                : null;
        int points = result.pointsEarned + (weekly == null ? 0 : weekly.bonusPoints());
        events.publishEvent(new ActivityEvent(user.getId(), ActivityEvent.Kind.ATTENDANCE, date)); // 오늘 할 일
        CharacterChangeResponse change = characterGrowthService.applyAttendance(user, points);
        AttendanceLogResponse response = AttendanceLogResponse.from(result.log, eventProgress, change, points,
                weekly == null ? null : weekly.bonusPoints(), weekly == null ? null : weekly.streakWeeks());
        // 보상 상자(주간 목표 확정 · 행운) · 도감 업적 — 운동한 날이 새로 생겼을 때만
        if (result.currentDidWorkout && !result.previousDidWorkout) {
            CollectionService.AttendanceReward reward = collectionService.onWorkoutDay(user, date, weekly != null);
            response.withReward(reward.box(), reward.unlocked());
        }
        return response;
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
        int currentStreak = calculateStreakForDate(user, LocalDate.now(clock));
        Integer bestStreakInMonth = calculateBestStreakInMonth(user, start, end);

        return AttendanceSummaryResponse.builder()
                .monthWorkoutCount(monthWorkoutCount)
                .currentStreak(currentStreak)
                .bestStreakInMonth(bestStreakInMonth)
                .build();
    }

    @Override
    @Transactional
    public AttendanceShareResponse shareByDate(String email, LocalDate date) {
        User user = getUserOrThrow(email);
        AttendanceLog log = attendanceLogRepository.findByUserAndDate(user, date)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attendance log not found."));

        if (log.getShareSlug() == null || log.getShareSlug().isBlank()) {
            log.setShareSlug(UUID.randomUUID().toString().replace("-", ""));
        }
        log.setShared(true);

        AttendanceLog saved = attendanceLogRepository.save(log);
        return toShareResponse(saved);
    }

    @Override
    @Transactional
    public void unshareByDate(String email, LocalDate date) {
        User user = getUserOrThrow(email);
        AttendanceLog log = attendanceLogRepository.findByUserAndDate(user, date)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attendance log not found."));

        log.setShared(false);
        log.setShareSlug(null);
        attendanceLogRepository.save(log);
    }

    @Override
    @Transactional(readOnly = true)
    public AttendancePublicShareResponse getSharedBySlug(String slug) {
        return toPublicShareResponse(findVisibleSharedOrThrow(slug));
    }

    /**
     * 응원 +1. 같은 사람(viewerKey: 로그인했으면 이메일, 아니면 IP)이 같은 글을 짧은 시간 안에
     * 다시 누르면 숫자를 올리지 않고 현재 상태만 돌려준다. +1 은 DB 에서 한 번에(update ... +1) 한다.
     */
    @Override
    @Transactional
    public AttendancePublicShareResponse addCheerBySlug(String slug, String viewerKey) {
        AttendanceLog log = findVisibleSharedOrThrow(slug);
        if (cheerGuard.tryCheer(viewerKey == null ? "unknown" : viewerKey, slug)) {
            attendanceLogRepository.incrementCheerCount(log.getId());
            // 로그인한 사람이 다른 사람 출석을 응원했으면 오늘 할 일 "응원 1번"
            if (viewerKey != null && viewerKey.startsWith("user:") && log.getUser() != null) {
                Long ownerId = log.getUser().getId();
                userRepository.findByEmail(viewerKey.substring("user:".length()))
                        .filter(viewer -> !viewer.getId().equals(ownerId))
                        .ifPresent(viewer -> events.publishEvent(
                                new ActivityEvent(viewer.getId(), ActivityEvent.Kind.CHEER, LocalDate.now(clock))));
            }
            log = findVisibleSharedOrThrow(slug); // update 후 영속성 컨텍스트가 비워져 다시 읽는다.
        }
        return toPublicShareResponse(log);
    }

    /**
     * 신고는 로그인한 사람만, 한 글에 한 번만 센다(attendance_share_reports 의 (글, 사람) UNIQUE).
     * 이미 신고했으면 숫자를 올리지 않고 현재 상태를 돌려준다.
     */
    @Override
    public AttendancePublicShareResponse reportBySlug(String slug, String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "신고는 로그인한 뒤에 할 수 있어요.");
        }
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        try {
            return tx.execute(status -> {
                User reporter = getUserOrThrow(email);
                AttendanceLog log = findVisibleSharedOrThrow(slug);
                if (!shareReportRepository.existsByAttendanceLogIdAndUserId(log.getId(), reporter.getId())) {
                    shareReportRepository.saveAndFlush(AttendanceShareReport.builder()
                            .attendanceLog(log)
                            .user(reporter)
                            .build());
                    attendanceLogRepository.incrementReportCount(log.getId());
                    log = findVisibleSharedOrThrow(slug);
                }
                return toPublicShareResponse(log);
            });
        } catch (DataIntegrityViolationException alreadyReported) {
            // 같은 사람이 거의 동시에 두 번 신고 → 하나는 이미 저장됨. 숫자는 그대로 두고 현재 상태만 준다.
            return tx.execute(status -> toPublicShareResponse(findVisibleSharedOrThrow(slug)));
        }
    }

    /**
     * 이번 주(월요일~오늘) 연속 출석 랭킹.
     * 예전에는 회원 전체를 읽고 회원마다 출석을 한 번씩 조회(N+1)했고, 출석 화면을 열 때마다 불렸다.
     * → 이번 주 운동 기록을 한 번에 읽어 메모리에서 계산하고, 결과를 2분 동안 재사용한다.
     *   (누군가 출석을 저장하면 upsertWithRetry 에서 캐시를 비운다.)
     * 점수 규칙은 그대로: 오늘부터 거꾸로 이어진 운동 일수(오늘 안 했으면 0).
     */
    @Override
    @Transactional(readOnly = true)
    public List<AttendanceRankingItemResponse> getWeeklyStreakRanking(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, RANKING_MAX_LIMIT));
        LocalDate today = LocalDate.now(clock);
        long now = clock.millis();
        WeeklyStreakSnapshot snapshot = weeklyStreakSnapshot;
        if (snapshot == null
                || !snapshot.today().equals(today)
                || now - snapshot.computedAtMillis() >= WEEKLY_STREAK_CACHE_TTL.toMillis()) {
            snapshot = new WeeklyStreakSnapshot(today, now, computeWeeklyStreakRanking(today));
            weeklyStreakSnapshot = snapshot;
        }
        return snapshot.items().stream().limit(safeLimit).toList();
    }

    private List<AttendanceRankingItemResponse> computeWeeklyStreakRanking(LocalDate today) {
        LocalDate weekStart = today.minusDays((today.getDayOfWeek().getValue() + 6) % 7);
        Map<Long, String> nicknameByUser = new HashMap<>();
        Map<Long, Set<LocalDate>> workoutDaysByUser = new HashMap<>();
        for (Object[] row : attendanceLogRepository.findWorkoutDaysWithNicknameBetween(weekStart, today)) {
            Long userId = (Long) row[0];
            nicknameByUser.putIfAbsent(userId, (String) row[1]);
            workoutDaysByUser.computeIfAbsent(userId, k -> new HashSet<>()).add((LocalDate) row[2]);
        }

        List<AttendanceRankingItemResponse> items = new ArrayList<>();
        for (Map.Entry<Long, Set<LocalDate>> entry : workoutDaysByUser.entrySet()) {
            int streak = 0;
            LocalDate cursor = today;
            while (!cursor.isBefore(weekStart) && entry.getValue().contains(cursor)) {
                streak += 1;
                cursor = cursor.minusDays(1);
            }
            if (streak > 0) {
                items.add(new AttendanceRankingItemResponse(entry.getKey(), nicknameByUser.get(entry.getKey()), streak));
            }
        }
        return items.stream()
                .sorted(Comparator.comparingInt(AttendanceRankingItemResponse::getScore).reversed()
                        .thenComparing(AttendanceRankingItemResponse::getUserId))
                .limit(RANKING_MAX_LIMIT)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceRankingItemResponse> getMonthlyMediaRanking(YearMonth month, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, RANKING_MAX_LIMIT));
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        List<Object[]> rows = attendanceLogRepository.countMediaLogsByUserBetween(start, end);
        // 예전에는 닉네임을 찾으려고 회원 전체(findAll)를 읽었다. 결과에 나온 회원만 읽는다.
        List<Long> userIds = rows.stream().map(row -> (Long) row[0]).toList();
        Map<Long, String> nickById = new HashMap<>();
        if (!userIds.isEmpty()) {
            userRepository.findAllById(userIds).forEach(u -> nickById.put(u.getId(), u.getNickname()));
        }

        return rows.stream()
                .map(row -> {
                    Long userId = (Long) row[0];
                    int score = ((Long) row[1]).intValue();
                    return new AttendanceRankingItemResponse(userId, nickById.getOrDefault(userId, "회원"), score);
                })
                .sorted(Comparator.comparingInt(AttendanceRankingItemResponse::getScore).reversed())
                .limit(safeLimit)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceShareResponse> listSharedForAdmin(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return attendanceLogRepository.findTop100BySharedTrueOrderByReportCountDescUpdatedAtDesc().stream()
                .limit(safeLimit)
                .map(AttendanceShareResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AttendanceShareResponse> listSharedForAdmin(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        return attendanceLogRepository
                .findBySharedTrueOrderByReportCountDescUpdatedAtDesc(PageRequest.of(safePage, safeSize))
                .map(AttendanceShareResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminAttendanceLogResponse> listLogsForAdmin(
            int page,
            int size,
            String query,
            Boolean didWorkout,
            Boolean shared,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        String normalizedQuery = (query == null || query.isBlank()) ? null : query.trim();
        return attendanceLogRepository
                .searchForAdmin(normalizedQuery, didWorkout, shared, fromDate, toDate, PageRequest.of(safePage, safeSize))
                .map(AdminAttendanceLogResponse::from);
    }

    @Override
    @Transactional
    public AttendanceShareResponse setHiddenByAdmin(Long attendanceId, boolean hidden) {
        AttendanceLog log = attendanceLogRepository.findById(attendanceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attendance log not found."));
        log.setHiddenByAdmin(hidden);
        AttendanceLog saved = attendanceLogRepository.save(log);
        return AttendanceShareResponse.from(saved);
    }

    private UpsertResult upsert(User user, LocalDate date, AttendanceUpsertRequest request, boolean allowCreate) {
        AttendanceInput input = normalizeInput(request);
        AttendanceLog existing = attendanceLogRepository.findByUserAndDate(user, date).orElse(null);
        if (existing == null && !allowCreate) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "이 날짜에는 출석 기록이 없어요. 출석은 그날 당일에만 남길 수 있어요.");
        }
        if (existing != null) {
            if (isSame(existing, input, request.getMemo())) {
                return new UpsertResult(existing, existing.isDidWorkout(), existing.isDidWorkout(), 0);
            }
            boolean previousDidWorkout = existing.isDidWorkout();
            existing.setDidWorkout(input.didWorkout());
            existing.setMemo(normalizeMemo(request.getMemo()));
            existing.setShareComment(input.shareComment());
            existing.setWorkoutTypes(input.workoutTypesCsv());
            existing.setWorkoutIntensity(input.workoutIntensity());
            existing.setMediaUrls(input.mediaUrlsCsv());
            existing.setEditCount(existing.getEditCount() + 1);
            existing.setLastEditedAt(LocalDateTime.now(clock));
            AttendanceLog saved = attendanceLogRepository.save(existing);
            // Update mode does not grant extra EXP to prevent repeated edit farming.
            return new UpsertResult(saved, previousDidWorkout, input.didWorkout(), 0);
        }

        AttendanceLog log = AttendanceLog.builder()
                .user(user)
                .date(date)
                .didWorkout(input.didWorkout())
                .memo(normalizeMemo(request.getMemo()))
                .shareComment(input.shareComment())
                .workoutTypes(input.workoutTypesCsv())
                .workoutIntensity(input.workoutIntensity())
                .mediaUrls(input.mediaUrlsCsv())
                .build();
        AttendanceLog saved = attendanceLogRepository.save(log);

        int pointsEarned = input.didWorkout() ? calculatePointsEarned(user, date, input, request.getMemo()) : 0;
        return new UpsertResult(saved, false, input.didWorkout(), pointsEarned);
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
        String mediaUrls = normalizeMediaUrls(request.getMediaUrls());
        String shareComment = normalizeShareComment(request.getShareComment());
        if (!didWorkout) {
            return new AttendanceInput(false, List.of(), null, null, mediaUrls, shareComment);
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

        return new AttendanceInput(true, normalizedTypes, intensity, joinTypes(normalizedTypes), mediaUrls, shareComment);
    }

    private boolean isSame(AttendanceLog log, AttendanceInput input, String memo) {
        String normalizedMemo = normalizeMemo(memo);
        String existingMemo = normalizeMemo(log.getMemo());
        String existingTypes = log.getWorkoutTypes() == null ? null : log.getWorkoutTypes();
        String inputTypes = input.workoutTypesCsv();
        String existingIntensity = log.getWorkoutIntensity();
        String existingMedia = normalizeMediaUrls(log.getMediaUrls());
        String inputMedia = input.mediaUrlsCsv();
        String existingShareComment = normalizeShareComment(log.getShareComment());
        String inputShareComment = input.shareComment();
        return log.isDidWorkout() == input.didWorkout()
                && equalsNullable(existingMemo, normalizedMemo)
                && equalsNullable(existingShareComment, inputShareComment)
                && equalsNullable(existingTypes, inputTypes)
                && equalsNullable(existingIntensity, input.workoutIntensity())
                && equalsNullable(existingMedia, inputMedia);
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

    private String normalizeShareComment(String comment) {
        if (comment == null) {
            return null;
        }
        String trimmed = comment.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String joinTypes(List<String> types) {
        if (types == null || types.isEmpty()) {
            return null;
        }
        return String.join(",", types);
    }

    private String normalizeMediaUrls(List<String> mediaUrls) {
        if (mediaUrls == null || mediaUrls.isEmpty()) {
            return null;
        }

        List<String> normalized = mediaUrls.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .limit(10)
                .toList();

        if (normalized.isEmpty()) {
            return null;
        }

        return String.join("\n", normalized);
    }

    private String normalizeMediaUrls(String rawMediaUrls) {
        if (rawMediaUrls == null || rawMediaUrls.isBlank()) {
            return null;
        }

        List<String> normalized = List.of(rawMediaUrls.split("\n")).stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .limit(10)
                .toList();

        if (normalized.isEmpty()) {
            return null;
        }

        return String.join("\n", normalized);
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

        if (input.mediaUrlsCsv() != null) {
            points += 1;
        }

        int streak = calculateStreakForDate(user, date);
        points += streakBonus(streak);
        return points;
    }

    private int countKeywordBonus(String memo) {
        int bonus = 0;
        String lower = memo.toLowerCase();
        for (String keyword : MEMO_KEYWORDS) {
            if (lower.contains(keyword.toLowerCase())) {
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

    /**
     * date 를 끝으로 거꾸로 이어진 운동 일수.
     * - date 에 "휴식" 기록이 있으면 0
     * - date 에 기록이 없으면 전날부터 센다(아직 오늘 출석 전인 경우)
     *
     * 예전에는 하루 거슬러 갈 때마다 쿼리를 한 번씩 보냈다(30일 연속이면 31번).
     * 지금은 STREAK_WINDOW_DAYS(120일) 구간을 한 번에 읽어 세고, 연속이 구간 끝까지 이어질 때만 다음 구간을 읽는다.
     */
    private int calculateStreakForDate(User user, LocalDate date) {
        Long userId = user.getId();
        int streak = 0;
        LocalDate cursor = null;
        LocalDate windowEnd = date;
        while (true) {
            LocalDate windowStart = windowEnd.minusDays(STREAK_WINDOW_DAYS - 1L);
            Map<LocalDate, Boolean> didWorkoutByDate = new HashMap<>();
            for (Object[] row : attendanceLogRepository.findDateFlagsByUserIdAndDateRange(userId, windowStart, windowEnd)) {
                didWorkoutByDate.put((LocalDate) row[0], (Boolean) row[1]);
            }
            if (cursor == null) {
                Boolean onDate = didWorkoutByDate.get(date);
                if (onDate != null && !onDate) {
                    return 0;
                }
                cursor = (onDate != null) ? date : date.minusDays(1);
            }
            while (!cursor.isBefore(windowStart)) {
                if (!Boolean.TRUE.equals(didWorkoutByDate.get(cursor))) {
                    return streak;
                }
                streak += 1;
                cursor = cursor.minusDays(1);
            }
            windowEnd = windowStart.minusDays(1);
        }
    }

    /** 작성자 본인용(공유 켜기 응답). 메모·신고 수까지 포함. */
    private AttendanceShareResponse toShareResponse(AttendanceLog log) {
        if (log.getUser() == null) {
            return AttendanceShareResponse.from(log, null);
        }
        int streak = calculateStreakForDate(log.getUser(), log.getDate());
        return AttendanceShareResponse.from(log, streak);
    }

    /** 공개 화면용. 메모·신고 수·내부 id·숨김 여부를 뺀다. */
    private AttendancePublicShareResponse toPublicShareResponse(AttendanceLog log) {
        Integer streak = log.getUser() == null ? null : calculateStreakForDate(log.getUser(), log.getDate());
        return AttendancePublicShareResponse.from(log, streak);
    }

    private AttendanceLog findVisibleSharedOrThrow(String slug) {
        AttendanceLog log = attendanceLogRepository.findByShareSlugAndSharedTrue(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공유된 출석 기록을 찾을 수 없어요."));
        if (log.isHiddenByAdmin()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "공유된 출석 기록을 찾을 수 없어요.");
        }
        return log;
    }

    private User getUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    }

    private record AttendanceInput(
            boolean didWorkout,
            List<String> workoutTypes,
            String workoutIntensity,
            String workoutTypesCsv,
            String mediaUrlsCsv,
            String shareComment
    ) {}

    private record UpsertResult(
            AttendanceLog log,
            boolean previousDidWorkout,
            boolean currentDidWorkout,
            int pointsEarned
    ) {}

    private record WeeklyStreakSnapshot(
            LocalDate today,
            long computedAtMillis,
            List<AttendanceRankingItemResponse> items
    ) {}
}
