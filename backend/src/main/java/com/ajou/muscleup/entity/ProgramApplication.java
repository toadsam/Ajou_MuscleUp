package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
// ProgramApplicationRepository.findAllByOrderByCreatedAtDesc — 신청 목록을
// 최신순으로 본다(관리자 화면 · 페이지네이션 있음).
@Table(
        name = "program_applications",
        indexes = @Index(name = "idx_program_app_created", columnList = "created_at")
)
public class ProgramApplication extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 500)
    private String goal;

    @Column(nullable = false, length = 50)
    private String track;

    @Column(nullable = false, length = 200)
    private String commitment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApplicationStatus status;
}
