package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.protein.*;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.User;
import org.springframework.data.domain.Page; import org.springframework.data.domain.Pageable;
import java.util.Collection;
import java.util.Map;

public interface ProteinService {
    Protein create(ProteinCreateUpdateRequest req, User owner);
    Protein update(Long id, ProteinCreateUpdateRequest req);
    void delete(Long id);
    Protein get(Long id);
    /**
     * 공동구매 목록. scope: "all"(내가 볼 수 있는 전부) · "gym"(내 짐들, gymSlug 가 있으면 그 짐만) · "public"(전체 모집).
     * 못 보는 글은 빠진다(GroupBuyAccess).
     */
    Page<Protein> list(User viewer, String scope, String gymSlug, String q, Pageable pageable);
    /** 못 보는 글이면 404 */
    void requireView(Protein p, User viewer);
    /** 상세의 여는 사람 신뢰 표시: [가입 후 지난 날, 누적 운동 일수] */
    long[] ownerTrust(Protein p);
    double averageRating(Long proteinId);
    long reviewCount(Long proteinId);
    /** 여러 모집글의 [평균 평점, 후기 수]를 쿼리 한 번으로. 후기가 없는 글은 map 에 없다 */
    Map<Long, double[]> ratingStats(Collection<Long> proteinIds);
    /** 작성자인지 */
    boolean isOwner(Protein p, String email);
    /** 영수증을 볼 수 있는지: 작성자 · 관리자 · 승인된 참여자 */
    boolean canSeeReceipt(Protein p, String email);
}
