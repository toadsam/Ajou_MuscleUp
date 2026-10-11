package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "proteins")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Protein {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false) private String name;
    private Integer price;
    private Integer days;
    private Integer goal;
    private String imageUrl;
    private String description;
    private String category;
    private Double avgRating; // 없으면 null

    // 모집 마감일(등록일 + days, 한국 시간 기준). 이 컬럼이 생기기 전 글은 null → "마감일 미정".
    private java.time.LocalDate deadline;

    // 영수증/실구매 인증 사진. 작성자 · 관리자 · 승인된 참여자에게만 내려간다.
    private String receiptUrl;

    // imageUrl 이 공개용 대표 이미지인지. null(예전 글)은 영수증 칸으로 올린 사진이라 비공개로 다룬다.
    private Boolean imagePublic;

    // 분배 방식: 직접 만나서 / 헬스장 보관함 / 택배 / 기타 (없으면 null)
    @Column(length = 20)
    private String distributionMethod;

    // 어느 짐(모임)에서 연 공동구매인지. null = 짐 없이 연 전체 모집
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gym_id")
    private WorkoutCrew gym;

    // 모집 범위(우리 모임만 / 전체 모집). 예전 글은 db/migration V3 에서 GYM(아주대 짐)으로 채운다
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private GroupBuyVisibility visibility;

    // 받는 지역(전체 모집에서 직거래 · 보관함일 때 참고)
    @Column(length = 40)
    private String region;

    // 최대 참여 인원(승인 기준). null 이면 제한 없음
    private Integer maxParticipants;

    public GroupBuyVisibility visibilityOrDefault() {
        if (visibility != null) return visibility;
        return gym != null ? GroupBuyVisibility.GYM : GroupBuyVisibility.PUBLIC;
    }
}
