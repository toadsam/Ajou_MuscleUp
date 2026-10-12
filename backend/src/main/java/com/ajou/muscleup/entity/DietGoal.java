package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/** 하루 영양 목표(사용자당 하나). 직접 정하거나 인바디 분석 결과에서 가져온다 */
@Entity
@Table(name = "diet_goals", uniqueConstraints = @UniqueConstraint(name = "uk_diet_goal_user", columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DietGoal extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    private Integer kcal;

    @Column(name = "protein_g")
    private Integer proteinG;

    @Column(name = "carb_g")
    private Integer carbG;

    @Column(name = "fat_g")
    private Integer fatG;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private DietSource source = DietSource.MANUAL;
}
