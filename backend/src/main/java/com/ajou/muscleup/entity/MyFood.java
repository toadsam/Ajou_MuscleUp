package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 내 음식 — 검색에 없는 음식(집밥, 학식, 단골 메뉴)을 이름 · 양 · 영양소 그대로 저장해 두고 다시 넣는다.
 * 값은 "그 양"(예: 1그릇) 기준. 본인만 본다. 탈퇴하면 AccountDeletionService 가 지운다.
 */
@Entity
@Table(name = "my_foods", indexes = @Index(name = "idx_my_food_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MyFood extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 60)
    private String name;

    /** 양(자유 글: "1그릇", "200g") */
    @Column(length = 30)
    private String amount;

    private Integer kcal;

    @Column(name = "protein_g")
    private Double proteinG;

    @Column(name = "carb_g")
    private Double carbG;

    @Column(name = "fat_g")
    private Double fatG;
}
