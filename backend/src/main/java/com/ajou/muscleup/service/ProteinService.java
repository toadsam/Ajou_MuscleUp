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
    Page<Protein> list(String q, Pageable pageable);
    double averageRating(Long proteinId);
    long reviewCount(Long proteinId);
    /** 여러 모집글의 [평균 평점, 후기 수]를 쿼리 한 번으로. 후기가 없는 글은 map 에 없다 */
    Map<Long, double[]> ratingStats(Collection<Long> proteinIds);
    /** 작성자인지 */
    boolean isOwner(Protein p, String email);
    /** 영수증을 볼 수 있는지: 작성자 · 관리자 · 승인된 참여자 */
    boolean canSeeReceipt(Protein p, String email);
}
