package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

/**
 * 식단 기록 한 줄 = 음식 하나. 같은 날 · 같은 끼니의 줄을 모아 한 끼로 보여 준다.
 * 본인만 본다(다른 사람에게 보내지 않음). 탈퇴하면 AccountDeletionService 가 지운다.
 */
@Entity
@Table(name = "meal_entries", indexes = @Index(name = "idx_meal_entry_user_day", columnList = "user_id, eaten_on"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MealEntry extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 먹은 날(한국 시간) */
    @Column(name = "eaten_on", nullable = false)
    private LocalDate eatenOn;

    @Enumerated(EnumType.STRING)
    @Column(name = "meal_type", nullable = false, length = 20)
    private MealType mealType;

    @Column(nullable = false, length = 60)
    private String name;

    /** 양(자유 글: "150g", "1공기") */
    @Column(length = 30)
    private String amount;

    private Integer kcal;

    @Column(name = "protein_g")
    private Double proteinG;

    @Column(name = "carb_g")
    private Double carbG;

    @Column(name = "fat_g")
    private Double fatG;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private DietSource source = DietSource.MANUAL;
}
