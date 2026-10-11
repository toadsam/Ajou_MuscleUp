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
}
