package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterRankingListResponse;
import com.ajou.muscleup.dto.character.CharacterRankingResponse;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class RankingServiceImpl implements RankingService {
    private final CharacterProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final UserBodyStatsRepository statsRepository;
    private final WorkoutCrewRepository gymRepository;
    private final WorkoutCrewMemberRepository memberRepository;
    private final GymPermissionService permissions;

    @Override
    @Transactional(readOnly = true)
    public CharacterRankingListResponse getCharacterRankings(String email, String type, int limit, String gymSlug) {
        if (gymSlug == null || gymSlug.isBlank()) return getCharacterRankings(email, type, limit);
        boolean threeLift = "THREE_LIFT".equalsIgnoreCase(type);
        if (!threeLift && !"LEVEL".equalsIgnoreCase(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ranking type");
        }
        User me = email == null ? null : userRepository.findByEmail(email).orElse(null);
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        WorkoutCrew gym = gymRepository.findBySlug(gymSlug.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요."));
        permissions.require(me, gym, GymPermissionService.GymAction.VIEW_MEMBERS);

        // 짐 멤버(수백 명 이내 전제)의 공개 캐릭터를 모아 메모리에서 정렬한다. 순서 규칙은 전체 순위와 같다(값 → 최근 갱신).
        List<User> users = memberRepository.findAllByCrewOrderByCreatedAtAsc(gym).stream().map(WorkoutCrewMember::getUser).toList();
        Map<Long, Double> totals = new HashMap<>();
        if (threeLift) {
            for (UserBodyStats s : statsRepository.findAllByUserIn(users)) totals.put(s.getUser().getId(), threeLiftOf(s));
        }
        Comparator<CharacterProfile> byUpdated = Comparator.comparing(CharacterProfile::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
        Comparator<CharacterProfile> order = threeLift
                ? Comparator.comparing((CharacterProfile p) -> totals.getOrDefault(p.getUser().getId(), 0.0), Comparator.reverseOrder()).thenComparing(byUpdated)
                : Comparator.comparing(CharacterProfile::getLevel, Comparator.reverseOrder()).thenComparing(byUpdated);
        List<CharacterProfile> ranked = profileRepository.findAllByUserIn(users).stream()
                .filter(CharacterProfile::isPublic)
                .filter(p -> !threeLift || totals.containsKey(p.getUser().getId()))
                .sorted(order)
                .toList();

        Integer myRank = null;
        for (int i = 0; i < ranked.size(); i++) {
            if (ranked.get(i).getUser().getId().equals(me.getId())) { myRank = i + 1; break; }
        }
        Double myTopPercent = myRank == null || ranked.isEmpty() ? null : Math.round((myRank * 1000.0 / ranked.size())) / 10.0;
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<CharacterRankingResponse> items = ranked.stream().limit(safeLimit)
                .map(p -> CharacterRankingResponse.builder()
                        .nickname(p.getUser().getNickname())
                        .level(p.getLevel())
                        .tier(p.getTier())
                        .evolutionStage(p.getEvolutionStage())
                        .title(p.getTitle())
                        .avatarSeed(p.getAvatarSeed())
                        .gender(p.getGender())
                        .isResting(p.isResting())
                        .threeLiftTotal(threeLift ? totals.get(p.getUser().getId()) : null)
                        .selfReported(true)
                        .updatedAt(p.getUpdatedAt())
                        .build())
                .toList();
        return CharacterRankingListResponse.builder()
                .items(items)
                .totalPublic((long) ranked.size())
                .myRank(myRank)
                .myTopPercent(myTopPercent)
                .build();
    }

    private static double threeLiftOf(UserBodyStats s) {
        return (s.getBenchKg() == null ? 0.0 : s.getBenchKg())
                + (s.getSquatKg() == null ? 0.0 : s.getSquatKg())
                + (s.getDeadliftKg() == null ? 0.0 : s.getDeadliftKg());
    }

    @Override
    @Transactional(readOnly = true)
    public CharacterRankingListResponse getCharacterRankings(String email, String type, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        long totalPublic = profileRepository.countByIsPublicTrue();
        if ("THREE_LIFT".equalsIgnoreCase(type)) {
            Integer myRank = calculateMyThreeLiftRank(email);
            Double myTopPercent = null;
            if (myRank != null && totalPublic > 0) {
                myTopPercent = Math.round((myRank * 1000.0 / totalPublic)) / 10.0;
            }
            return CharacterRankingListResponse.builder()
                    .items(fetchThreeLiftRankings(safeLimit))
                    .totalPublic(totalPublic)
                    .myRank(myRank)
                    .myTopPercent(myTopPercent)
                    .build();
        }
        if (!"LEVEL".equalsIgnoreCase(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ranking type");
        }
        Integer myRank = calculateMyLevelRank(email);
        Double myTopPercent = null;
        if (myRank != null && totalPublic > 0) {
            myTopPercent = Math.round((myRank * 1000.0 / totalPublic)) / 10.0;
        }
        return CharacterRankingListResponse.builder()
                .items(fetchLevelRankings(safeLimit))
                .totalPublic(totalPublic)
                .myRank(myRank)
                .myTopPercent(myTopPercent)
                .build();
    }

    private List<CharacterRankingResponse> fetchLevelRankings(int limit) {
        return profileRepository.findByIsPublicTrueOrderByLevelDescUpdatedAtDesc(PageRequest.of(0, limit))
                .stream()
                .map(profile -> CharacterRankingResponse.builder()
                        .nickname(profile.getUser().getNickname())
                        .level(profile.getLevel())
                        .tier(profile.getTier())
                        .evolutionStage(profile.getEvolutionStage())
                        .title(profile.getTitle())
                        .avatarSeed(profile.getAvatarSeed())
                        .gender(profile.getGender())
                        .isResting(profile.isResting())
                        .threeLiftTotal(null)
                        // 레벨도 본인이 입력한 키·몸무게·3대 중량으로 계산된다(검증 없음).
                        .selfReported(true)
                        .updatedAt(profile.getUpdatedAt())
                        .build())
                .toList();
    }

    private List<CharacterRankingResponse> fetchThreeLiftRankings(int limit) {
        List<Object[]> rows = profileRepository
                .findPublicWithStatsOrderByThreeLiftDesc(PageRequest.of(0, limit))
                .getContent();
        List<CharacterRankingResponse> result = new ArrayList<>();
        for (Object[] row : rows) {
            CharacterProfile profile = (CharacterProfile) row[0];
            UserBodyStats stats = (UserBodyStats) row[1];
            User user = (User) row[2];
            Double total = null;
            if (stats != null) {
                double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
                double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
                double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
                total = bench + squat + deadlift;
            }
            result.add(CharacterRankingResponse.builder()
                    .nickname(user.getNickname())
                    .level(profile.getLevel())
                    .tier(profile.getTier())
                    .evolutionStage(profile.getEvolutionStage())
                    .title(profile.getTitle())
                    .avatarSeed(profile.getAvatarSeed())
                    .gender(profile.getGender())
                    .isResting(profile.isResting())
                    .threeLiftTotal(total)
                    // 3대 중량은 본인 입력값이다(인증 기록 아님). 화면에서 "본인 입력" 표시용.
                    .selfReported(true)
                    .updatedAt(profile.getUpdatedAt())
                    .build());
        }
        return result;
    }

    private Integer calculateMyLevelRank(String email) {
        if (email == null) return null;
        return userRepository.findByEmail(email)
                .flatMap(profileRepository::findByUser)
                .filter(CharacterProfile::isPublic)
                .map(profile -> {
                    long higher = profileRepository.countByIsPublicTrueAndLevelGreaterThan(profile.getLevel());
                    long sameAfter = profileRepository.countByIsPublicTrueAndLevelEqualsAndUpdatedAtAfter(
                            profile.getLevel(), profile.getUpdatedAt());
                    return (int) (higher + sameAfter + 1);
                })
                .orElse(null);
    }

    private Integer calculateMyThreeLiftRank(String email) {
        if (email == null) return null;
        return userRepository.findByEmail(email)
                .flatMap(user -> profileRepository.findByUser(user)
                        .filter(CharacterProfile::isPublic)
                        .flatMap(profile -> statsRepository.findByUser(user)
                                .map(stats -> {
                                    double bench = stats.getBenchKg() == null ? 0.0 : stats.getBenchKg();
                                    double squat = stats.getSquatKg() == null ? 0.0 : stats.getSquatKg();
                                    double deadlift = stats.getDeadliftKg() == null ? 0.0 : stats.getDeadliftKg();
                                    double total = bench + squat + deadlift;
                                    long higher = profileRepository.countPublicWithThreeLiftGreaterThan(total);
                                    long sameAfter = profileRepository.countPublicWithThreeLiftEqualsAndUpdatedAtAfter(
                                            total, profile.getUpdatedAt());
                                    return (int) (higher + sameAfter + 1);
                                })))
                .orElse(null);
    }
}
