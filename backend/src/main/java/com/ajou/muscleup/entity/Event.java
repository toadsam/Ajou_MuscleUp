package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "events")
public class Event extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, length = 200)
    private String description;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "required_attendance_count", nullable = false)
    private int requiredAttendanceCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private EventStatus status;

    // 어느 짐(모임)의 출석 이벤트인지. null = 앱 전체. 그 짐 멤버의 출석만 센다(예전 이벤트는 V4 에서 아주대 짐)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gym_id")
    private WorkoutCrew gym;
}
