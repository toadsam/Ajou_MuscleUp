package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.protein.*;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.ProteinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page; import org.springframework.data.domain.PageRequest; import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import java.util.Map;
import org.springframework.http.ResponseEntity; import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/proteins")
@RequiredArgsConstructor
public class ProteinController {
    private final ProteinService proteinService;
    private final UserRepository userRepository;
    private static final int MAX_PAGE_SIZE = 50;

    /** 상세 응답: 평균 · 후기 수 + 보는 사람 기준 mine · 영수증 */
    private ProteinResponse detail(Protein p, String email) {
        long count = proteinService.reviewCount(p.getId());
        ProteinResponse res = ProteinResponse.from(p, count > 0 ? proteinService.averageRating(p.getId()) : null);
        res.setReviewCount(count);
        res.setMine(proteinService.isOwner(p, email));
        if (proteinService.canSeeReceipt(p, email)) res.setReceiptUrl(ProteinResponse.receiptOf(p));
        return res;
    }

    @PostMapping
    public ResponseEntity<?> create(@AuthenticationPrincipal String email,
                                    @Valid @RequestBody ProteinCreateUpdateRequest req) {
        User owner = userRepository.findByEmail(email).orElse(null);
        Protein saved = proteinService.create(req, owner);
        return ResponseEntity.ok(detail(saved, email));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@AuthenticationPrincipal String email,
                                    @PathVariable("id") Long id, @RequestBody ProteinCreateUpdateRequest req) {
        return ResponseEntity.ok(detail(proteinService.update(id, req), email));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") Long id) {
        proteinService.delete(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@AuthenticationPrincipal String email, @PathVariable("id") Long id) {
        Protein p = proteinService.get(id);
        // 우리 모임만 공동구매는 그 모임 멤버 · 작성자 · 운영자만(아니면 404)
        proteinService.requireView(p, userRepository.findByEmail(email).orElse(null));
        ProteinResponse res = detail(p, email);
        long[] trust = proteinService.ownerTrust(p);
        if (trust != null) {
            res.setOwnerMemberDays(trust[0] < 0 ? null : trust[0]);
            res.setOwnerWorkoutDays(trust[1]);
        }
        return ResponseEntity.ok(res);
    }

    @GetMapping
    public ResponseEntity<?> list(@AuthenticationPrincipal String email,
                                  @RequestParam(value = "q", required = false) String q,
                                  // all(기본: 내가 볼 수 있는 전부) · gym(우리 모임) · public(전체 모집), gym=슬러그 면 그 모임만
                                  @RequestParam(value = "scope", required = false) String scope,
                                  @RequestParam(value = "gym", required = false) String gym,
                                  @RequestParam(value = "page", defaultValue = "0") int page,
                                  @RequestParam(value = "size", defaultValue = "12") int size) {
        // 한 번에 최대 50개, 최신 글부터
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "id"));
        User viewer = userRepository.findByEmail(email).orElse(null);
        Page<Protein> result = proteinService.list(viewer, scope, gym, q, pageable);
        // 평균 평점 · 후기 수를 글마다 묻지 않고 한 번에 모아 온다(예전: 글 수만큼 쿼리)
        Map<Long, double[]> stats = proteinService.ratingStats(result.map(Protein::getId).getContent());
        return ResponseEntity.ok(result.map(p -> {
            double[] s = stats.get(p.getId());
            ProteinResponse res = ProteinResponse.from(p, s != null ? s[0] : null);
            res.setReviewCount(s != null ? (long) s[1] : 0L);
            res.setMine(proteinService.isOwner(p, email));
            return res; // 목록에는 영수증을 싣지 않는다
        }));
    }
}
