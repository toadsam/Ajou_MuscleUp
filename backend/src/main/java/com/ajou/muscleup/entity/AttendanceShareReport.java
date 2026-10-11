package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 공유된 출석 인증글 신고 기록. 한 사람은 한 글을 한 번만 신고할 수 있다.
 * (예전에는 로그인 없이 POST 한 번마다 report_count 가 1씩 올라 누구나 숫자를 부풀릴 수 있었다.)
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "attendance_share_reports",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_attendance_share_report_log_user",
                columnNames = {"attendance_log_id", "user_id"}
        )
)
public class AttendanceShareReport extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attendance_log_id", nullable = false)
    private AttendanceLog attendanceLog;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
}
