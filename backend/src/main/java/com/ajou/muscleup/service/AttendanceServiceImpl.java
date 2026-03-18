package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.attendance.AttendanceLogResponse;
import com.ajou.muscleup.dto.attendance.AttendanceRankingItemResponse;
import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
import com.ajou.muscleup.dto.attendance.AttendanceSummaryResponse;
import com.ajou.muscleup.dto.attendance.AttendanceUpsertRequest;
import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private static final List<String> MEMO_KEYWORDS = List.of("PR", "deadlift", "squat", "bench", "record");

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
    public AttendanceShareResponse getSharedBySlug(String slug) {
        AttendanceLog log = attendanceLogRepository.findByShareSlugAndSharedTrue(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shared attendance not found."));
        if (log.isHiddenByAdmin()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Shared attendance not found.");
        }
        return toShareResponse(log);
    }

    @Override
    @Transactional
    public AttendanceShareResponse addCheerBySlug(String slug) {
        AttendanceLog log = attendanceLogRepository.findByShareSlugAndSharedTrue(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shared attendance not found."));
        if (log.isHiddenByAdmin()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Shared attendance not found.");
        }
        log.setCheerCount(log.getCheerCount() + 1);
        return toShareResponse(attendanceLogRepository.save(log));
    }

    @Override
    @Transactional
    public AttendanceShareResponse reportBySlug(String slug) {
        AttendanceLog log = attendanceLogRepository.findByShareSlugAndSharedTrue(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shared attendance not found."));
        log.setReportCount(log.getReportCount() + 1);
        return toShareResponse(attendanceLogRepository.save(log));
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceRankingItemResponse> getWeeklyStreakRanking(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        LocalDate today = LocalDate.now(KST);
        LocalDate weekStart = today.minusDays((today.getDayOfWeek().getValue() + 6) % 7);

        return userRepository.findAll().stream()
                .map(user -> {
                    List<AttendanceLog> logs = attendanceLogRepository.findByUserIdAndDateRangeOrderByDateAsc(
                            user.getId(), weekStart, today);
                    int streak = calculateCurrentStreakInRange(logs, weekStart, today);
                    return new AttendanceRankingItemResponse(user.getId(), user.getNickname(), streak);
                })
                .filter(item -> item.getScore() > 0)
                .sorted(Comparator.comparingInt(AttendanceRankingItemResponse::getScore).reversed())
                .limit(safeLimit)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceRankingItemResponse> getMonthlyMediaRanking(YearMonth month, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        Map<Long, String> nickById = userRepository.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, User::getNickname, (a, b) -> a));

        return attendanceLogRepository.countMediaLogsByUserBetween(start, end).stream()
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
    @Transactional
    public AttendanceShareResponse setHiddenByAdmin(Long attendanceId, boolean hidden) {
        AttendanceLog log = attendanceLogRepository.findById(attendanceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attendance log not found."));
        log.setHiddenByAdmin(hidden);
        AttendanceLog saved = attendanceLogRepository.save(log);
        return AttendanceShareResponse.from(saved);
    }

    private UpsertResult upsert(User user, LocalDate date, AttendanceUpsertRequest request) {
        AttendanceInput input = normalizeInput(request);
        AttendanceLog existing = attendanceLogRepository.findByUserAndDate(user, date).orElse(null);
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
            existing.setLastEditedAt(LocalDateTime.now(KST));
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

    private int calculateCurrentStreakInRange(List<AttendanceLog> logs, LocalDate start, LocalDate end) {
        Map<LocalDate, Boolean> map = new HashMap<>();
        for (AttendanceLog log : logs) {
            map.put(log.getDate(), log.isDidWorkout());
        }
        LocalDate cursor = end;
        int streak = 0;
        while (!cursor.isBefore(start)) {
            if (Boolean.TRUE.equals(map.get(cursor))) {
                streak += 1;
                cursor = cursor.minusDays(1);
                continue;
            }
            break;
        }
        return streak;
    }

    private AttendanceShareResponse toShareResponse(AttendanceLog log) {
        if (log.getUser() == null) {
            return AttendanceShareResponse.from(log, null);
        }
        int streak = calculateStreakForDate(log.getUser(), log.getDate());
        return AttendanceShareResponse.from(log, streak);
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
}
