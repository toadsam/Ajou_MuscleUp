package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import lombok.*;

/**
 * 짐(Gym) = 모든 모임의 공통 단위(동아리 · 운동 모임 · 헬스장 · 트레이너). 예전 "운동 모임" 테이블을 키웠다.
 * 설계: docs/design/stage0-gyms.md. 새 칸은 기존 행 때문에 DB 에서 null 허용이고, db/migration V2 가 채운다.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "workout_crews")
public class WorkoutCrew extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(length = 300)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(unique = true, length = 20)
    private String inviteCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    @Builder.Default
    private CrewJoinPolicy joinPolicy = CrewJoinPolicy.AUTO_APPROVE;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    @Builder.Default
    private GymType type = GymType.CREW;

    /** 주소 /g/{slug}. 소문자 · 숫자 · 하이픈 */
    @Column(unique = true, length = 40)
    private String slug;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    @Builder.Default
    private GymVisibility visibility = GymVisibility.PUBLIC;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    @Builder.Default
    private GymStatus status = GymStatus.ACTIVE;

    /** 동아리 안 소모임이면 그 동아리 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private WorkoutCrew parent;

    /** 학교 인증 · 학교 대항 리그용(예: ajou.ac.kr) */
    @Column(name = "school_domain", length = 60)
    private String schoolDomain;

    @Column(length = 40)
    private String region;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    /** 지도 테마. 지금은 GYM 하나 */
    @Column(name = "map_theme", length = 16)
    private String mapTheme;

    @Column(name = "member_limit")
    private Integer memberLimit;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "gym_features", joinColumns = @JoinColumn(name = "gym_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "feature", length = 24)
    @Builder.Default
    private Set<GymFeature> features = new HashSet<>();

    // 새 칸은 기존 행에서 null 일 수 있다(db/migration V2 가 채움). 읽을 때는 이 값을 쓴다.
    public GymType typeOrDefault() {
        return type != null ? type : GymType.CREW;
    }

    public GymStatus statusOrDefault() {
        return status != null ? status : GymStatus.ACTIVE;
    }

    public GymVisibility visibilityOrDefault() {
        return visibility != null ? visibility : GymVisibility.PUBLIC;
    }
}
