package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.protein.ProteinCreateUpdateRequest;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.ProteinShareStatus;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.ProteinRepository;
import com.ajou.muscleup.repository.ProteinShareApplicationRepository;
import com.ajou.muscleup.repository.ReviewRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.ajou.muscleup.entity.GroupBuyVisibility;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.util.RoleUtils;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException; import org.springframework.http.HttpStatus;

@Service
@RequiredArgsConstructor
@Transactional
public class ProteinServiceImpl implements ProteinService {
    private final ProteinRepository proteinRepository;
    private final ReviewRepository reviewRepository;
    private final ProteinShareApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final WorkoutCrewRepository gymRepository;
    private final GroupBuyAccess access;

    /** 짐을 고르지 않고 연 "우리 모임" 공동구매가 들어갈 짐(짐 고르기 화면이 생기기 전까지의 기본값) */
    @Value("${app.default-gym-slug:ajou-muscleup}")
    private String defaultGymSlug;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 분배 방식으로 받는 값. 그 밖의 값은 저장하지 않는다(null) */
    private static final Set<String> DISTRIBUTION_METHODS = Set.of("직접 만나서", "헬스장 보관함", "택배", "기타");

    private static String normalizeDistribution(String raw) {
        if (raw == null) return null;
        String v = raw.trim();
        return DISTRIBUTION_METHODS.contains(v) ? v : null;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    /** 모집 마감일 = 오늘(한국 시간) + 모집 기간(일) */
    private static LocalDate deadlineFrom(Integer days) {
        return days != null && days > 0 ? LocalDate.now(KST).plusDays(days) : null;
    }

    @Override
    public Protein create(ProteinCreateUpdateRequest req, User owner) {
        if (owner == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        WorkoutCrew gym = resolveGym(req, owner);
        GroupBuyVisibility visibility = req.getVisibility() != null ? req.getVisibility()
                : (gym != null ? GroupBuyVisibility.GYM : GroupBuyVisibility.PUBLIC);
        if (visibility == GroupBuyVisibility.GYM && gym == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "우리 모임 공동구매는 모임을 골라야 해요. 들어간 모임이 없으면 전체 모집으로 열어 주세요.");
        }
        access.requireCanOpen(owner, gym, visibility);
        Protein p = Protein.builder()
                .gym(gym)
                .visibility(visibility)
                .region(blankToNull(req.getRegion()))
                .maxParticipants(req.getMaxParticipants())
                .owner(owner)
                .name(req.getName()).price(req.getPrice()).days(req.getDays()).goal(req.getGoal())
                .imageUrl(blankToNull(req.getImageUrl())).description(req.getDescription()).category(req.getCategory())
                // 새 글의 imageUrl 은 "대표 이미지" 칸에서만 온다 → 공개
                .imagePublic(Boolean.TRUE)
                .receiptUrl(blankToNull(req.getReceiptUrl()))
                .distributionMethod(normalizeDistribution(req.getDistributionMethod()))
                .deadline(deadlineFrom(req.getDays()))
                .build();
        return proteinRepository.save(p);
    }

    @Override
    public Protein update(Long id, ProteinCreateUpdateRequest req) {
        Protein p = get(id);
        if (req.getName() != null) p.setName(req.getName());
        if (req.getPrice() != null) p.setPrice(req.getPrice());
        if (req.getDays() != null) {
            p.setDays(req.getDays());
            p.setDeadline(deadlineFrom(req.getDays())); // 기간을 고치면 오늘부터 다시 센다
        }
        if (req.getGoal() != null) p.setGoal(req.getGoal());
        if (req.getImageUrl() != null) {
            // 예전 글의 imageUrl(영수증)을 대표 이미지로 덮기 전에 영수증 칸으로 옮겨 둔다
            if (!Boolean.TRUE.equals(p.getImagePublic()) && p.getReceiptUrl() == null) {
                p.setReceiptUrl(p.getImageUrl());
            }
            p.setImageUrl(blankToNull(req.getImageUrl()));
            p.setImagePublic(Boolean.TRUE);
        }
        if (req.getReceiptUrl() != null) p.setReceiptUrl(blankToNull(req.getReceiptUrl()));
        if (req.getDistributionMethod() != null) p.setDistributionMethod(normalizeDistribution(req.getDistributionMethod()));
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getCategory() != null) p.setCategory(req.getCategory());
        if (req.getRegion() != null) p.setRegion(blankToNull(req.getRegion()));
        if (req.getMaxParticipants() != null) p.setMaxParticipants(req.getMaxParticipants());
        return p; // dirty checking
    }

    @Override public void delete(Long id) { proteinRepository.delete(get(id)); }

    @Override @Transactional(readOnly = true)
    public Protein get(Long id) {
        return proteinRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "공동구매 글을 찾을 수 없어요."));
    }

    @Override @Transactional(readOnly = true)
    public Page<Protein> list(User viewer, String scope, String gymSlug, String q, Pageable pageable) {
        String query = q == null ? "" : q.trim(); // 빈 문자열이면 전부(ProteinRepository.NAME_FILTER 주석)
        if (gymSlug != null && !gymSlug.isBlank()) {
            WorkoutCrew gym = gymRepository.findBySlug(gymSlug.trim().toLowerCase(java.util.Locale.ROOT))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요."));
            if (!access.myGymIdsForQuery(viewer).contains(gym.getId()) && !RoleUtils.isAdmin(viewer)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "그 모임 멤버만 볼 수 있어요.");
            }
            return proteinRepository.searchInGyms(List.of(gym.getId()), query, pageable);
        }
        if ("public".equalsIgnoreCase(scope)) return proteinRepository.searchPublic(query, pageable);
        if ("gym".equalsIgnoreCase(scope)) return proteinRepository.searchInGyms(access.myGymIdsForQuery(viewer), query, pageable);
        return proteinRepository.searchVisible(RoleUtils.isAdmin(viewer), access.myGymIdsForQuery(viewer), query, pageable);
    }

    @Override @Transactional(readOnly = true)
    public void requireView(Protein p, User viewer) {
        access.requireView(p, viewer);
    }

    @Override @Transactional(readOnly = true)
    public long[] ownerTrust(Protein p) {
        if (p.getOwner() == null) return null;
        long days = access.memberDays(p.getOwner());
        return new long[]{days > 100000 ? -1 : days, access.workoutDays(p.getOwner())};
    }

    /** gymSlug 가 있으면 그 짐, 없고 전체 모집이 아니면 기본 짐(멤버일 때만) */
    private WorkoutCrew resolveGym(ProteinCreateUpdateRequest req, User owner) {
        if (req.getGymSlug() != null && !req.getGymSlug().isBlank()) {
            return gymRepository.findBySlug(req.getGymSlug().trim().toLowerCase(java.util.Locale.ROOT))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "모임을 찾을 수 없어요."));
        }
        if (req.getVisibility() == GroupBuyVisibility.PUBLIC) return null;
        return gymRepository.findBySlug(defaultGymSlug)
                .filter(g -> access.myGymIdsForQuery(owner).contains(g.getId()))
                .orElse(null);
    }

    @Override @Transactional(readOnly = true)
    public double averageRating(Long proteinId) { return reviewRepository.avgRatingByProteinId(proteinId); }

    @Override @Transactional(readOnly = true)
    public long reviewCount(Long proteinId) { return reviewRepository.countByProteinId(proteinId); }

    @Override @Transactional(readOnly = true)
    public Map<Long, double[]> ratingStats(Collection<Long> proteinIds) {
        Map<Long, double[]> out = new HashMap<>();
        if (proteinIds == null || proteinIds.isEmpty()) return out;
        for (Object[] row : reviewRepository.ratingStatsByProteinIds(proteinIds)) {
            Long id = (Long) row[0];
            double avg = row[1] != null ? ((Number) row[1]).doubleValue() : 0;
            double count = row[2] != null ? ((Number) row[2]).doubleValue() : 0;
            out.put(id, new double[]{avg, count});
        }
        return out;
    }

    @Override @Transactional(readOnly = true)
    public boolean isOwner(Protein p, String email) {
        return email != null && p.getOwner() != null && email.equalsIgnoreCase(p.getOwner().getEmail());
    }

    @Override @Transactional(readOnly = true)
    public boolean canSeeReceipt(Protein p, String email) {
        if (email == null || email.isBlank()) return false;
        if (isOwner(p, email)) return true;
        User viewer = userRepository.findByEmail(email).orElse(null);
        if (viewer == null) return false;
        if (com.ajou.muscleup.util.RoleUtils.isAdmin(viewer)) return true;
        return applicationRepository.findByProteinIdAndUserId(p.getId(), viewer.getId())
                .map(a -> a.getStatus() == ProteinShareStatus.APPROVED)
                .orElse(false);
    }
}
