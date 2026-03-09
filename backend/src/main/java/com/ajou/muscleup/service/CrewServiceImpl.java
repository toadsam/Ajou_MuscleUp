package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.crew.*;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CrewChallenge;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.CrewChallengeRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class CrewServiceImpl implements CrewService {
    private static final double ATTENDANCE_WEIGHT = 0.40;
    private static final double CHALLENGE_WEIGHT = 0.40;
    private static final double RECENT_DAY_WEIGHT = 2.50;
    private static final double PERFECT_ATTENDANCE_BONUS = 10.0;
    private static final double CHALLENGE_CAP = 130.0;

    private final UserRepository userRepository;
    private final WorkoutCrewRepository workoutCrewRepository;
    private final WorkoutCrewMemberRepository workoutCrewMemberRepository;
    private final CharacterProfileRepository characterProfileRepository;
    private final CrewChallengeRepository crewChallengeRepository;
    private final AttendanceLogRepository attendanceLogRepository;

    @Override
    public CrewDetailResponse create(String email, CrewCreateRequest request) {
        User user = getUserByEmailOrThrow(email);
        WorkoutCrew crew = workoutCrewRepository.save(
                WorkoutCrew.builder()
                        .name(request.getName().trim())
                        .description(normalize(request.getDescription()))
                        .owner(user)
                        .inviteCode(generateInviteCode())
                        .build()
        );
        workoutCrewMemberRepository.save(
                WorkoutCrewMember.builder()
                        .crew(crew)
                        .user(user)
                        .role(WorkoutCrewMemberRole.LEADER)
                        .build()
        );
        return buildDetail(crew, user, YearMonth.now());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CrewListItemResponse> list(String email) {
        User me = getUserByEmailOrThrow(email);
        List<WorkoutCrew> crews = workoutCrewRepository.findAll();
        return crews.stream()
                .sorted(Comparator.comparing(WorkoutCrew::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(crew -> CrewListItemResponse.builder()
                        .id(crew.getId())
                        .name(crew.getName())
                        .description(crew.getDescription())
                        .ownerNickname(crew.getOwner().getNickname())
                        .memberCount(workoutCrewMemberRepository.countByCrew(crew))
                        .joined(workoutCrewMemberRepository.existsByCrewAndUser(crew, me))
                        .inviteCode(crew.getInviteCode())
                        .build())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CrewDetailResponse getDetail(String email, Long crewId, YearMonth month) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        return buildDetail(crew, me, month);
    }

    @Override
    public void join(String email, Long crewId) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        joinCrewIfNotExists(me, crew);
    }

    @Override
    public void joinByInviteCode(String email, String inviteCode) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = workoutCrewRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "유효하지 않은 초대코드입니다."));
        joinCrewIfNotExists(me, crew);
    }

    @Override
    public void leave(String email, Long crewId) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        WorkoutCrewMember member = workoutCrewMemberRepository.findByCrewAndUser(crew, me)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "가입된 모임이 아닙니다."));

        if (member.getRole() == WorkoutCrewMemberRole.LEADER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임장은 탈퇴할 수 없습니다.");
        }
        workoutCrewMemberRepository.delete(member);
    }

    @Override
    public CrewDetailResponse update(String email, Long crewId, CrewUpdateRequest request) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        ensureLeader(crew, me);
        crew.setName(request.getName().trim());
        crew.setDescription(normalize(request.getDescription()));
        return buildDetail(crew, me, YearMonth.now());
    }

    @Override
    public void delete(String email, Long crewId) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        ensureLeader(crew, me);
        crewChallengeRepository.deleteAll(crewChallengeRepository.findAllByCrewOrderByStartDateDesc(crew));
        workoutCrewMemberRepository.deleteAllByCrew(crew);
        workoutCrewRepository.delete(crew);
    }

    @Override
    public void kickMember(String email, Long crewId, Long memberUserId) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        ensureLeader(crew, me);
        if (Objects.equals(crew.getOwner().getId(), memberUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임장은 강퇴할 수 없습니다.");
        }
        User target = userRepository.findById(memberUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "유저를 찾을 수 없습니다."));
        WorkoutCrewMember member = workoutCrewMemberRepository.findByCrewAndUser(crew, target)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임 멤버가 아닙니다."));
        workoutCrewMemberRepository.delete(member);
    }

    @Override
    public CrewChallengeResponse createChallenge(String email, Long crewId, CrewChallengeCreateRequest request) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        ensureLeader(crew, me);
        validateChallengeRequest(request);
        CrewChallenge saved = crewChallengeRepository.save(CrewChallenge.builder()
                .crew(crew)
                .title(request.getTitle().trim())
                .description(normalize(request.getDescription()))
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .targetWorkoutDays(request.getTargetWorkoutDays())
                .build());
        return buildChallengeResponse(saved, crew);
    }

    @Override
    public CrewChallengeResponse updateChallenge(String email, Long crewId, Long challengeId, CrewChallengeCreateRequest request) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        ensureLeader(crew, me);
        validateChallengeRequest(request);
        CrewChallenge challenge = getChallengeOrThrow(challengeId);
        if (!Objects.equals(challenge.getCrew().getId(), crew.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임 챌린지가 아닙니다.");
        }
        challenge.setTitle(request.getTitle().trim());
        challenge.setDescription(normalize(request.getDescription()));
        challenge.setStartDate(request.getStartDate());
        challenge.setEndDate(request.getEndDate());
        challenge.setTargetWorkoutDays(request.getTargetWorkoutDays());
        return buildChallengeResponse(challenge, crew);
    }

    @Override
    public void deleteChallenge(String email, Long crewId, Long challengeId) {
        User me = getUserByEmailOrThrow(email);
        WorkoutCrew crew = getCrewOrThrow(crewId);
        ensureLeader(crew, me);
        CrewChallenge challenge = getChallengeOrThrow(challengeId);
        if (!Objects.equals(challenge.getCrew().getId(), crew.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임 챌린지가 아닙니다.");
        }
        crewChallengeRepository.delete(challenge);
    }

    private CrewDetailResponse buildDetail(WorkoutCrew crew, User me, YearMonth month) {
        List<WorkoutCrewMember> members = workoutCrewMemberRepository.findAllByCrewOrderByCreatedAtAsc(crew);
        Map<Long, CharacterProfile> profileMap = buildCharacterProfileMap(members);
        boolean joined = members.stream().anyMatch(m -> Objects.equals(m.getUser().getId(), me.getId()));
        boolean leader = Objects.equals(crew.getOwner().getId(), me.getId());

        LocalDate start = month.atDay(1);
        LocalDate end = month.atEndOfMonth();
        LocalDate today = LocalDate.now();
        if (month.equals(YearMonth.now()) && today.isBefore(end)) {
            end = today;
        }
        int targetDays = Math.max(1, (int) (end.toEpochDay() - start.toEpochDay() + 1));

        Map<Long, Long> workoutCountByUser = countWorkout(members, start, end);

        List<CrewMemberAttendanceResponse> memberResponses = members.stream()
                .map(member -> {
                    Long userId = member.getUser().getId();
                    CharacterProfile profile = profileMap.get(userId);
                    long workoutDays = workoutCountByUser.getOrDefault(member.getUser().getId(), 0L);
                    double attendanceRate = (workoutDays * 100.0) / targetDays;
                    return CrewMemberAttendanceResponse.builder()
                            .userId(userId)
                            .nickname(member.getUser().getNickname())
                            .role(member.getRole())
                            .workoutDays(workoutDays)
                            .targetDays(targetDays)
                            .attendanceRate(Math.round(attendanceRate * 10.0) / 10.0)
                            .characterTier(profile != null ? profile.getTier() : null)
                            .characterStage(profile != null ? profile.getEvolutionStage() : null)
                            .characterLevel(profile != null ? profile.getLevel() : null)
                            .avatarSeed(profile != null ? profile.getAvatarSeed() : null)
                            .build();
                })
                .sorted(Comparator.comparing(CrewMemberAttendanceResponse::getAttendanceRate).reversed())
                .toList();

        List<CrewChallengeResponse> challenges = crewChallengeRepository.findAllByCrewOrderByStartDateDesc(crew).stream()
                .map(challenge -> buildChallengeResponse(challenge, crew))
                .toList();

        List<CrewCompetitionEntryResponse> competitionBoard = buildCompetitionBoard(crew, members, memberResponses);
        List<CrewKingTitleResponse> kingTitles = buildKingTitles(memberResponses, competitionBoard);

        return CrewDetailResponse.builder()
                .id(crew.getId())
                .name(crew.getName())
                .description(crew.getDescription())
                .ownerNickname(crew.getOwner().getNickname())
                .inviteCode(crew.getInviteCode())
                .joined(joined)
                .leader(leader)
                .month(month.toString())
                .targetDays(targetDays)
                .members(memberResponses)
                .challenges(challenges)
                .kingTitles(kingTitles)
                .competitionBoard(competitionBoard)
                .build();
    }

    private CrewChallengeResponse buildChallengeResponse(CrewChallenge challenge, WorkoutCrew crew) {
        List<WorkoutCrewMember> members = workoutCrewMemberRepository.findAllByCrewOrderByCreatedAtAsc(crew);
        Map<Long, CharacterProfile> profileMap = buildCharacterProfileMap(members);
        Map<Long, Long> workoutCountByUser = countWorkout(members, challenge.getStartDate(), challenge.getEndDate());
        List<CrewChallengeMemberProgressResponse> progress = members.stream()
                .map(member -> {
                    Long userId = member.getUser().getId();
                    CharacterProfile profile = profileMap.get(userId);
                    long workoutDays = workoutCountByUser.getOrDefault(member.getUser().getId(), 0L);
                    double rate = (workoutDays * 100.0) / challenge.getTargetWorkoutDays();
                    return CrewChallengeMemberProgressResponse.builder()
                            .userId(userId)
                            .nickname(member.getUser().getNickname())
                            .workoutDays(workoutDays)
                            .targetWorkoutDays(challenge.getTargetWorkoutDays())
                            .completionRate(Math.round(rate * 10.0) / 10.0)
                            .badge(resolveBadge(rate))
                            .characterTier(profile != null ? profile.getTier() : null)
                            .characterStage(profile != null ? profile.getEvolutionStage() : null)
                            .characterLevel(profile != null ? profile.getLevel() : null)
                            .avatarSeed(profile != null ? profile.getAvatarSeed() : null)
                            .build();
                })
                .sorted(Comparator.comparing(CrewChallengeMemberProgressResponse::getCompletionRate).reversed())
                .toList();

        return CrewChallengeResponse.builder()
                .id(challenge.getId())
                .title(challenge.getTitle())
                .description(challenge.getDescription())
                .startDate(challenge.getStartDate())
                .endDate(challenge.getEndDate())
                .status(resolveChallengeStatus(challenge.getStartDate(), challenge.getEndDate()))
                .targetWorkoutDays(challenge.getTargetWorkoutDays())
                .members(progress)
                .build();
    }

    private List<CrewCompetitionEntryResponse> buildCompetitionBoard(
            WorkoutCrew crew,
            List<WorkoutCrewMember> members,
            List<CrewMemberAttendanceResponse> monthAttendance
    ) {
        if (members.isEmpty()) {
            return List.of();
        }

        Map<Long, Double> attendanceRateMap = new HashMap<>();
        monthAttendance.forEach(item -> attendanceRateMap.put(item.getUserId(), item.getAttendanceRate()));

        LocalDate today = LocalDate.now();
        LocalDate recentStart = today.minusDays(6);
        Map<Long, Long> recentWorkoutMap = countWorkout(members, recentStart, today);

        List<CrewChallenge> challenges = crewChallengeRepository.findAllByCrewOrderByStartDateDesc(crew);
        Map<Long, Double> challengeAverageMap = new HashMap<>();
        if (!challenges.isEmpty()) {
            Map<Long, Double> sum = new HashMap<>();
            Map<Long, Integer> count = new HashMap<>();
            for (CrewChallenge challenge : challenges) {
                Map<Long, Long> workoutMap = countWorkout(members, challenge.getStartDate(), challenge.getEndDate());
                for (WorkoutCrewMember member : members) {
                    Long userId = member.getUser().getId();
                    long workoutDays = workoutMap.getOrDefault(userId, 0L);
                    double completion = (workoutDays * 100.0) / challenge.getTargetWorkoutDays();
                    sum.put(userId, sum.getOrDefault(userId, 0.0) + completion);
                    count.put(userId, count.getOrDefault(userId, 0) + 1);
                }
            }
            for (WorkoutCrewMember member : members) {
                Long userId = member.getUser().getId();
                double avg = sum.getOrDefault(userId, 0.0) / Math.max(1, count.getOrDefault(userId, 1));
                challengeAverageMap.put(userId, round1(avg));
            }
        }

        List<CrewCompetitionEntryResponse> board = members.stream()
                .map(member -> {
                    Long userId = member.getUser().getId();
                    double attendanceRate = attendanceRateMap.getOrDefault(userId, 0.0);
                    long recentWorkoutDays = recentWorkoutMap.getOrDefault(userId, 0L);
                    double challengeAverage = challengeAverageMap.getOrDefault(userId, 0.0);
                    double cappedChallenge = Math.min(challengeAverage, CHALLENGE_CAP);

                    double attendanceScore = attendanceRate * ATTENDANCE_WEIGHT;
                    double challengeScore = cappedChallenge * CHALLENGE_WEIGHT;
                    double recentScore = recentWorkoutDays * RECENT_DAY_WEIGHT;
                    double bonusScore = attendanceRate >= 100.0 ? PERFECT_ATTENDANCE_BONUS : 0.0;
                    double score = attendanceScore + challengeScore + recentScore + bonusScore;

                    return CrewCompetitionEntryResponse.builder()
                            .rank(0)
                            .userId(userId)
                            .nickname(member.getUser().getNickname())
                            .score(round1(score))
                            .attendanceScore(round1(attendanceScore))
                            .challengeScore(round1(challengeScore))
                            .recentScore(round1(recentScore))
                            .bonusScore(round1(bonusScore))
                            .attendanceRate(round1(attendanceRate))
                            .recentWorkoutDays(recentWorkoutDays)
                            .challengeAverageCompletion(round1(challengeAverage))
                            .build();
                })
                .sorted(Comparator
                        .comparingDouble(CrewCompetitionEntryResponse::getScore).reversed()
                        .thenComparing(Comparator.comparingDouble(CrewCompetitionEntryResponse::getAttendanceRate).reversed())
                        .thenComparing(CrewCompetitionEntryResponse::getNickname))
                .toList();

        List<CrewCompetitionEntryResponse> ranked = new ArrayList<>();
        for (int i = 0; i < board.size(); i++) {
            CrewCompetitionEntryResponse item = board.get(i);
            ranked.add(CrewCompetitionEntryResponse.builder()
                    .rank(i + 1)
                    .userId(item.getUserId())
                    .nickname(item.getNickname())
                    .score(item.getScore())
                    .attendanceScore(item.getAttendanceScore())
                    .challengeScore(item.getChallengeScore())
                    .recentScore(item.getRecentScore())
                    .bonusScore(item.getBonusScore())
                    .attendanceRate(item.getAttendanceRate())
                    .recentWorkoutDays(item.getRecentWorkoutDays())
                    .challengeAverageCompletion(item.getChallengeAverageCompletion())
                    .build());
        }
        return ranked;
    }

    private List<CrewKingTitleResponse> buildKingTitles(
            List<CrewMemberAttendanceResponse> monthAttendance,
            List<CrewCompetitionEntryResponse> board
    ) {
        if (board.isEmpty()) {
            return List.of();
        }

        CrewMemberAttendanceResponse attendanceKing = monthAttendance.stream()
                .max(Comparator.comparing(CrewMemberAttendanceResponse::getAttendanceRate))
                .orElse(null);
        CrewCompetitionEntryResponse recentKing = board.stream()
                .max(Comparator.comparing(CrewCompetitionEntryResponse::getRecentWorkoutDays))
                .orElse(null);
        CrewCompetitionEntryResponse challengeKing = board.stream()
                .max(Comparator.comparing(CrewCompetitionEntryResponse::getChallengeAverageCompletion))
                .orElse(null);

        List<CrewKingTitleResponse> result = new ArrayList<>();
        if (attendanceKing != null) {
            result.add(CrewKingTitleResponse.builder()
                    .title("성실왕")
                    .userId(attendanceKing.getUserId())
                    .nickname(attendanceKing.getNickname())
                    .metric(attendanceKing.getAttendanceRate() + "%")
                    .build());
        }
        if (recentKing != null) {
            result.add(CrewKingTitleResponse.builder()
                    .title("연승왕")
                    .userId(recentKing.getUserId())
                    .nickname(recentKing.getNickname())
                    .metric("최근 7일 " + recentKing.getRecentWorkoutDays() + "회")
                    .build());
        }
        if (challengeKing != null) {
            result.add(CrewKingTitleResponse.builder()
                    .title("도전왕")
                    .userId(challengeKing.getUserId())
                    .nickname(challengeKing.getNickname())
                    .metric(challengeKing.getChallengeAverageCompletion() + "%")
                    .build());
        }
        return result;
    }

    private Map<Long, Long> countWorkout(List<WorkoutCrewMember> members, LocalDate start, LocalDate end) {
        List<Long> userIds = members.stream().map(m -> m.getUser().getId()).toList();
        Map<Long, Long> workoutCountByUser = new HashMap<>();
        if (!userIds.isEmpty()) {
            for (Object[] row : attendanceLogRepository.countWorkoutByUserIdsAndDateBetween(userIds, start, end)) {
                Long userId = (Long) row[0];
                Long count = (Long) row[1];
                workoutCountByUser.put(userId, count);
            }
        }
        return workoutCountByUser;
    }

    private String resolveBadge(double rate) {
        if (rate >= 120) return "LEGEND";
        if (rate >= 100) return "GOLD";
        if (rate >= 70) return "SILVER";
        if (rate >= 40) return "BRONZE";
        return "STARTER";
    }

    private String resolveChallengeStatus(LocalDate start, LocalDate end) {
        LocalDate today = LocalDate.now();
        if (today.isBefore(start)) return "UPCOMING";
        if (today.isAfter(end)) return "ENDED";
        return "ONGOING";
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private Map<Long, CharacterProfile> buildCharacterProfileMap(List<WorkoutCrewMember> members) {
        if (members == null || members.isEmpty()) {
            return Map.of();
        }
        List<User> users = members.stream().map(WorkoutCrewMember::getUser).toList();
        Map<Long, CharacterProfile> result = new HashMap<>();
        characterProfileRepository.findAllByUserIn(users).forEach(profile ->
                result.put(profile.getUser().getId(), profile)
        );
        return result;
    }

    private void joinCrewIfNotExists(User me, WorkoutCrew crew) {
        if (workoutCrewMemberRepository.existsByCrewAndUser(crew, me)) {
            return;
        }
        workoutCrewMemberRepository.save(
                WorkoutCrewMember.builder()
                        .crew(crew)
                        .user(me)
                        .role(WorkoutCrewMemberRole.MEMBER)
                        .build()
        );
    }

    private void ensureLeader(WorkoutCrew crew, User user) {
        if (!Objects.equals(crew.getOwner().getId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "모임장만 가능한 작업입니다.");
        }
    }

    private void validateChallengeRequest(CrewChallengeCreateRequest request) {
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "챌린지 종료일은 시작일보다 빠를 수 없습니다.");
        }
    }

    private CrewChallenge getChallengeOrThrow(Long challengeId) {
        return crewChallengeRepository.findById(challengeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "챌린지를 찾을 수 없습니다."));
    }

    private WorkoutCrew getCrewOrThrow(Long crewId) {
        return workoutCrewRepository.findById(crewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없습니다."));
    }

    private User getUserByEmailOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String generateInviteCode() {
        final String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        SecureRandom random = new SecureRandom();
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
            String code = sb.toString();
            if (!workoutCrewRepository.existsByInviteCode(code)) return code;
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "초대코드 생성에 실패했습니다.");
    }
}
