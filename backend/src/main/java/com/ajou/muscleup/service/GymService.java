package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.gym.GymCreateRequest;
import com.ajou.muscleup.dto.gym.GymMemberResponse;
import com.ajou.muscleup.dto.gym.GymMemberRoleRequest;
import com.ajou.muscleup.dto.gym.GymSummaryResponse;
import com.ajou.muscleup.dto.gym.GymUpdateRequest;
import com.ajou.muscleup.entity.CrewJoinPolicy;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.GymVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.ajou.muscleup.service.GymPermissionService.GymAction;
import com.ajou.muscleup.util.RoleUtils;
import java.security.SecureRandom;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 짐(Gym) — 모든 모임(동아리 · 운동 모임 · 헬스장 · 트레이너)의 공통 API. 설계: docs/design/stage0-gyms.md.
 * 저장은 예전 "운동 모임" 테이블(WorkoutCrew)을 그대로 쓴다. 운동 모임 화면(/api/crew)은 CREW 종류만 다룬다.
 *
 * - 만들기: 앱 운영자가 아니면 PENDING(승인 대기)으로 만들어지고, 운영자가 승인해야 찾기에 보인다(시범 기간 승인제).
 * - 보기: PUBLIC · UNLISTED 는 누구나(로그인 없이도) 주소로 볼 수 있고, PRIVATE · 승인 전 · 보관된 짐은 멤버와 운영자만.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class GymService {
    private static final Set<String> RESERVED_SLUGS = Set.of(
            "admin", "api", "new", "mine", "square", "login", "join", "settings", "g", "gym", "gyms");

    private final WorkoutCrewRepository gymRepository;
    private final WorkoutCrewMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final GymPermissionService permissions;
    private final GymScope gymScope;

    /* ---------- 읽기 ---------- */

    /** 찾기: 운영 중(ACTIVE) · 공개(PUBLIC) 짐. 종류 · 학교 · 이름으로 거른다. */
    @Transactional(readOnly = true)
    public List<GymSummaryResponse> search(String email, GymType type, String query, String school) {
        User me = findUser(email);
        String q = query == null ? null : query.trim().toLowerCase(Locale.ROOT);
        Map<Long, Long> counts = memberCounts();
        Set<Long> mine = me == null ? Set.of() : new HashSet<>(memberRepository.findCrewIdsByUserId(me.getId()));
        return gymRepository.findAllWithOwner().stream()
                .filter(g -> g.statusOrDefault() == GymStatus.ACTIVE && g.visibilityOrDefault() == GymVisibility.PUBLIC)
                .filter(g -> type == null || g.typeOrDefault() == type)
                .filter(g -> school == null || school.isBlank() || school.equalsIgnoreCase(g.getSchoolDomain()))
                .filter(g -> q == null || q.isEmpty() || g.getName().toLowerCase(Locale.ROOT).contains(q))
                .sorted(Comparator.comparing((WorkoutCrew g) -> counts.getOrDefault(g.getId(), 0L)).reversed())
                .map(g -> toSummary(g, me, counts.getOrDefault(g.getId(), 0L), mine.contains(g.getId())))
                .toList();
    }

    /** 내가 속한 짐(승인 대기 · 보관 포함) */
    @Transactional(readOnly = true)
    public List<GymSummaryResponse> mine(String email) {
        User me = requireUser(email);
        Map<Long, Long> counts = memberCounts();
        return memberRepository.findAllByUser(me).stream()
                .map(WorkoutCrewMember::getCrew)
                .sorted(Comparator.comparing(WorkoutCrew::getId))
                .map(g -> toSummary(g, me, counts.getOrDefault(g.getId(), 0L), true))
                .toList();
    }

    @Transactional(readOnly = true)
    public GymSummaryResponse get(String email, String slug, String inviteCode) {
        User me = findUser(email);
        WorkoutCrew gym = visibleGymOrThrow(slug, me, inviteCode);
        boolean joined = me != null && permissions.roleOf(gym, me).isPresent();
        return toSummary(gym, me, memberRepository.countByCrew(gym), joined);
    }

    /**
     * 멤버 목록. staffOnly=true 면 모임장 · 운영진만(짐을 볼 수 있는 사람 누구나 — 운영진 소개용),
     * 아니면 멤버만 볼 수 있다.
     */
    @Transactional(readOnly = true)
    public List<GymMemberResponse> members(String email, String slug, boolean staffOnly, String inviteCode) {
        User me = findUser(email);
        WorkoutCrew gym = visibleGymOrThrow(slug, me, inviteCode);
        if (!staffOnly) {
            if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
            permissions.require(me, gym, GymAction.VIEW_MEMBERS);
        }
        return memberRepository.findAllByCrewOrderByCreatedAtAsc(gym).stream()
                .filter(m -> !staffOnly || effectiveRole(gym, m) != WorkoutCrewMemberRole.MEMBER)
                .sorted(Comparator.comparing((WorkoutCrewMember m) -> effectiveRole(gym, m).ordinal()))
                .map(m -> new GymMemberResponse(m.getUser().getId(), m.getUser().getNickname(), effectiveRole(gym, m), m.getTitle(), m.getCreatedAt()))
                .toList();
    }

    /* ---------- 쓰기 ---------- */

    public GymSummaryResponse create(String email, GymCreateRequest req) {
        User me = requireUser(email);
        String slug = req.slug().trim().toLowerCase(Locale.ROOT);
        if (RESERVED_SLUGS.contains(slug)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "쓸 수 없는 주소예요. 다른 주소를 골라 주세요.");
        }
        if (gymRepository.existsBySlug(slug)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 쓰는 주소예요. 다른 주소를 골라 주세요.");
        }
        boolean admin = RoleUtils.isAdmin(me);
        WorkoutCrew gym = gymRepository.save(WorkoutCrew.builder()
                .name(req.name().trim())
                .description(blankToNull(req.description()))
                .owner(me)
                .inviteCode(generateInviteCode())
                .joinPolicy(req.joinPolicy() != null ? req.joinPolicy() : CrewJoinPolicy.LEADER_APPROVE)
                .type(req.type())
                .slug(slug)
                .visibility(req.visibility() != null ? req.visibility() : GymVisibility.PUBLIC)
                .status(admin ? GymStatus.ACTIVE : GymStatus.PENDING)
                .schoolDomain(blankToNull(req.schoolDomain()))
                .region(blankToNull(req.region()))
                .mapTheme("GYM")
                .features(EnumSet.allOf(GymFeature.class))
                .build());
        memberRepository.save(WorkoutCrewMember.builder().crew(gym).user(me).role(WorkoutCrewMemberRole.OWNER).build());
        return toSummary(gym, me, 1, true);
    }

    public GymSummaryResponse update(String email, String slug, GymUpdateRequest req) {
        User me = requireUser(email);
        WorkoutCrew gym = gymOrThrow(slug);
        permissions.require(me, gym, GymAction.MANAGE_SETTINGS);
        if (req.name() != null) gym.setName(req.name().trim());
        if (req.description() != null) gym.setDescription(blankToNull(req.description()));
        if (req.visibility() != null) gym.setVisibility(req.visibility());
        if (req.joinPolicy() != null) gym.setJoinPolicy(req.joinPolicy());
        if (req.region() != null) gym.setRegion(blankToNull(req.region()));
        if (req.logoUrl() != null) gym.setLogoUrl(blankToNull(req.logoUrl()));
        if (req.mapTheme() != null) gym.setMapTheme(req.mapTheme());
        if (req.features() != null) {
            gym.getFeatures().clear();
            gym.getFeatures().addAll(req.features());
        }
        return toSummary(gym, me, memberRepository.countByCrew(gym), true);
    }

    /** 운영진 임명 · 해임 · 직함. 모임장만. 모임장 자신의 역할은 바꿀 수 없다. */
    public GymMemberResponse setMemberRole(String email, String slug, Long userId, GymMemberRoleRequest req) {
        User me = requireUser(email);
        WorkoutCrew gym = gymOrThrow(slug);
        permissions.require(me, gym, GymAction.MANAGE_STAFF);
        if (req.role() == WorkoutCrewMemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임장 넘기기는 아직 지원하지 않아요.");
        }
        if (Objects.equals(gym.getOwner().getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모임장의 역할은 바꿀 수 없어요.");
        }
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "사용자를 찾을 수 없어요."));
        WorkoutCrewMember member = memberRepository.findByCrewAndUser(gym, target)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "이 모임 멤버가 아니에요."));
        member.setRole(req.role());
        member.setTitle(req.role() == WorkoutCrewMemberRole.STAFF ? blankToNull(req.title()) : null);
        return new GymMemberResponse(target.getId(), target.getNickname(), member.getRole(), member.getTitle(), member.getCreatedAt());
    }

    /* ---------- 앱 운영자 ---------- */

    @Transactional(readOnly = true)
    public List<GymSummaryResponse> listByStatus(String email, GymStatus status) {
        User me = requireUser(email);
        Map<Long, Long> counts = memberCounts();
        return gymRepository.findAllByStatusOrderByCreatedAtAsc(status).stream()
                .map(g -> toSummary(g, me, counts.getOrDefault(g.getId(), 0L), false))
                .toList();
    }

    public GymSummaryResponse setStatus(String email, Long gymId, GymStatus status) {
        User me = requireUser(email);
        WorkoutCrew gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요."));
        gym.setStatus(status);
        return toSummary(gym, me, memberRepository.countByCrew(gym), false);
    }

    /* ---------- 내부 ---------- */

    private WorkoutCrewMemberRole effectiveRole(WorkoutCrew gym, WorkoutCrewMember m) {
        if (Objects.equals(gym.getOwner().getId(), m.getUser().getId())) return WorkoutCrewMemberRole.OWNER;
        return m.getRole() != null ? m.getRole() : WorkoutCrewMemberRole.MEMBER;
    }

    /**
     * PRIVATE · 승인 전 · 보관된 짐은 멤버와 앱 운영자에게만 보인다(없는 것처럼 404).
     * 단, 맞는 초대 코드를 가진 사람은 보관되지 않은 짐을 볼 수 있다(초대 링크 /g/{slug}?code=… 로 들어와 가입).
     */
    private WorkoutCrew visibleGymOrThrow(String slug, User me, String inviteCode) {
        return gymScope.visibleOrThrow(slug, me, inviteCode);
    }

    private WorkoutCrew gymOrThrow(String slug) {
        return gymRepository.findBySlug(slug == null ? "" : slug.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요."));
    }

    private GymSummaryResponse toSummary(WorkoutCrew g, User me, long memberCount, boolean joined) {
        WorkoutCrewMemberRole myRole = me == null ? null : permissions.roleOf(g, me).orElse(null);
        return GymSummaryResponse.builder()
                .id(g.getId())
                .slug(g.getSlug())
                .name(g.getName())
                .description(g.getDescription())
                .type(g.typeOrDefault())
                .visibility(g.visibilityOrDefault())
                .status(g.statusOrDefault())
                .schoolDomain(g.getSchoolDomain())
                .region(g.getRegion())
                .logoUrl(g.getLogoUrl())
                .mapTheme(g.getMapTheme())
                .parentSlug(g.getParent() != null ? g.getParent().getSlug() : null)
                .joinPolicy(g.getJoinPolicy())
                .features(Set.copyOf(g.getFeatures()))
                .memberCount(memberCount)
                .joined(joined)
                .myRole(myRole)
                .inviteCode(joined ? g.getInviteCode() : null)
                .build();
    }

    private Map<Long, Long> memberCounts() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : memberRepository.countMembersGroupByCrewId()) counts.put((Long) row[0], (Long) row[1]);
        return counts;
    }

    /** permitAll 경로에서 비로그인이면 principal 이 null 이거나 "anonymousUser" 문자열이다. */
    private User findUser(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) return null;
        return userRepository.findByEmail(email).orElse(null);
    }

    private User requireUser(String email) {
        User me = findUser(email);
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        return me;
    }

    private static String blankToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }

    private String generateInviteCode() {
        final String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        SecureRandom random = new SecureRandom();
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
            String code = sb.toString();
            if (!gymRepository.existsByInviteCode(code)) return code;
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "초대 코드를 만들지 못했어요.");
    }
}
