package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AttendanceShareReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceShareReportRepository extends JpaRepository<AttendanceShareReport, Long> {
    boolean existsByAttendanceLogIdAndUserId(Long attendanceLogId, Long userId);
}
