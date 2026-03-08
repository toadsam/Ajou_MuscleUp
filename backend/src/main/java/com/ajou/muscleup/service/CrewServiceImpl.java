package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.crew.*;
import com.ajou.muscleup.entity.CrewChallenge;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.AttendanceLogRepository;
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
    private final UserRepository userRepository;
    private final WorkoutCrewRepository workoutCrewRepository;
    private final WorkoutCrewMemberRepository workoutCrewMemberRepository;
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
                    long workoutDays = workoutCountByUser.getOrDefault(member.getUser().getId(), 0L);
                    double attendanceRate = (workoutDays * 100.0) / targetDays;
                    return CrewMemberAttendanceResponse.builder()
                            .userId(member.getUser().getId())
                            .nickname(member.getUser().getNickname())
                            .role(member.getRole())
                            .workoutDays(workoutDays)
                            .targetDays(targetDays)
                            .attendanceRate(Math.round(attendanceRate * 10.0) / 10.0)
                            .build();
                })
                .sorted(Comparator.comparing(CrewMemberAttendanceResponse::getAttendanceRate).reversed())
                .toList();

        List<CrewChallengeResponse> challenges = crewChallengeRepository.findAllByCrewOrderByStartDateDesc(crew).stream()
                .map(challenge -> buildChallengeResponse(challenge, crew))
                .toList();

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
                .build();
    }

    private CrewChallengeResponse buildChallengeResponse(CrewChallenge challenge, WorkoutCrew crew) {
        List<WorkoutCrewMember> members = workoutCrewMemberRepository.findAllByCrewOrderByCreatedAtAsc(crew);
        Map<Long, Long> workoutCountByUser = countWorkout(members, challenge.getStartDate(), challenge.getEndDate());
        List<CrewChallengeMemberProgressResponse> progress = members.stream()
                .map(member -> {
                    long workoutDays = workoutCountByUser.getOrDefault(member.getUser().getId(), 0L);
                    double rate = (workoutDays * 100.0) / challenge.getTargetWorkoutDays();
                    return CrewChallengeMemberProgressResponse.builder()
                            .userId(member.getUser().getId())
                            .nickname(member.getUser().getNickname())
                            .workoutDays(workoutDays)
                            .targetWorkoutDays(challenge.getTargetWorkoutDays())
                            .completionRate(Math.round(rate * 10.0) / 10.0)
                            .badge(resolveBadge(rate))
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
                .targetWorkoutDays(challenge.getTargetWorkoutDays())
                .members(progress)
                .build();
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
