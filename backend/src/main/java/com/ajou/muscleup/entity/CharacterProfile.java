package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "character_profiles",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id"})
)
public class CharacterProfile extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false)
    private int level;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CharacterTier tier;

    @Column(name = "evolution_stage", nullable = false)
    private int evolutionStage;

    @Column(nullable = false, length = 40)
    private String title;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(name = "last_evaluated_at")
    private LocalDateTime lastEvaluatedAt;

    @Column(name = "attendance_points", nullable = false)
    private int attendancePoints;

    @Column(name = "avatar_seed", length = 64)
    private String avatarSeed;

    @Column(name = "style_preset", length = 32)
    private String stylePreset;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Gender gender;

    @Column(name = "is_resting", nullable = false)
    private boolean isResting;

    @Column(name = "reroll_count", nullable = false)
    private int rerollCount;
}
