package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ContentReport;
import com.ajou.muscleup.entity.ReportStatus;
import com.ajou.muscleup.entity.ReportTargetType;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContentReportRepository extends JpaRepository<ContentReport, Long> {
    boolean existsByReporter_IdAndTargetTypeAndTargetId(Long reporterId, ReportTargetType type, Long targetId);

    long countByReporter_IdAndCreatedAtAfter(Long reporterId, LocalDateTime after);

    Page<ContentReport> findAllByStatusOrderByCreatedAtDesc(ReportStatus status, Pageable pageable);

    Page<ContentReport> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<ContentReport> findAllByTargetTypeAndTargetIdAndStatus(ReportTargetType type, Long targetId, ReportStatus status);
}
