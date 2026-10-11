// src/main/java/com/ajou/muscleup/dto/ProteinResponse.java
package com.ajou.muscleup.dto.protein;

import com.ajou.muscleup.entity.Protein;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProteinResponse {
    private Long id;
    private Long ownerId;
    private String ownerEmail;
    private String ownerNickname;
    private String name;
    private Integer price;
    private Integer days;
    private Integer goal;
    private String imageUrl;
    private String description;
    private String category;
    private Double avgRating;   // 평균 평점(후기가 없으면 null)
    private Long reviewCount;   // 후기 수(목록 · 상세에서 채움)
    private LocalDate deadline; // 모집 마감일(예전 글은 null)
    private Integer daysLeft;   // 오늘 기준 남은 날(마감일이 지났으면 음수, 마감일 없으면 null)
    private boolean closed;     // 마감일이 지났는지
    private String distributionMethod;
    private String receiptUrl;  // 작성자 · 관리자 · 승인된 참여자에게만 채운다
    private boolean mine;       // 보는 사람이 작성자인지
    private String gymSlug;     // 연 짐(없으면 null)
    private String gymName;
    private com.ajou.muscleup.entity.GroupBuyVisibility visibility; // GYM 우리 모임만 · PUBLIC 전체 모집
    private String region;
    private Integer maxParticipants;
    // 상세에서만: 여는 사람 신뢰 표시(가입 후 지난 날 · 누적 운동 일수)
    private Long ownerMemberDays;
    private Long ownerWorkoutDays;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 엔티티만으로 DTO 생성 */
    public static ProteinResponse from(Protein p) {
        return from(p, null);
    }

    /** 엔티티 + 평균평점(계산/덮어쓰기)으로 DTO 생성 */
    public static ProteinResponse from(Protein p, Double avgOverride) {
        if (p == null) return null;

        LocalDate today = LocalDate.now(KST);
        Integer daysLeft = p.getDeadline() != null ? (int) ChronoUnit.DAYS.between(today, p.getDeadline()) : null;

        return ProteinResponse.builder()
                .id(p.getId())
                .ownerId(p.getOwner() != null ? p.getOwner().getId() : null)
                // 이메일은 목록 · 상세 응답에 내보내지 않는다. 작성자 여부는 mine 으로 알려 준다.
                .ownerEmail(null)
                .ownerNickname(p.getOwner() != null ? p.getOwner().getNickname() : null)
                .name(p.getName())
                .price(p.getPrice())
                .days(p.getDays())
                .goal(p.getGoal())
                // 예전 글(imagePublic == null)의 imageUrl 은 영수증 칸으로 올린 사진이라 공개하지 않는다
                .imageUrl(Boolean.TRUE.equals(p.getImagePublic()) ? p.getImageUrl() : null)
                .description(p.getDescription())
                .category(p.getCategory())
                // avgOverride가 있으면 우선 적용, 없으면 엔티티 값 사용
                .avgRating(avgOverride != null ? avgOverride : p.getAvgRating())
                .deadline(p.getDeadline())
                .daysLeft(daysLeft)
                .closed(daysLeft != null && daysLeft < 0)
                .distributionMethod(p.getDistributionMethod())
                .gymSlug(p.getGym() != null ? p.getGym().getSlug() : null)
                .gymName(p.getGym() != null ? p.getGym().getName() : null)
                .visibility(p.visibilityOrDefault())
                .region(p.getRegion())
                .maxParticipants(p.getMaxParticipants())
                .receiptUrl(null)
                .mine(false)
                .build();
    }

    /** 영수증 사진 원본: receiptUrl, 없으면 예전 글의 imageUrl(영수증 칸으로 올린 것) */
    public static String receiptOf(Protein p) {
        if (p == null) return null;
        if (p.getReceiptUrl() != null && !p.getReceiptUrl().isBlank()) return p.getReceiptUrl();
        return Boolean.TRUE.equals(p.getImagePublic()) ? null : p.getImageUrl();
    }
}
