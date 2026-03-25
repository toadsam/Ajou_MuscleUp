package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AttendanceLogRepository extends JpaRepository<AttendanceLog, Long> {
    Optional<AttendanceLog> findByUserAndDate(User user, LocalDate date);

    Optional<AttendanceLog> findByShareSlugAndSharedTrue(String shareSlug);

    List<AttendanceLog> findTop100BySharedTrueOrderByReportCountDescUpdatedAtDesc();
    Page<AttendanceLog> findBySharedTrueOrderByReportCountDescUpdatedAtDesc(Pageable pageable);

    List<AttendanceLog> findAllByUserAndDateBetweenOrderByDateAsc(User user, LocalDate start, LocalDate end);

    long countByUserAndDidWorkoutTrueAndDateBetween(User user, LocalDate start, LocalDate end);

    long countByDate(LocalDate date);

    @Query("""
            select l
            from AttendanceLog l
            where l.user.id = :userId
              and l.date between :start and :end
            order by l.date asc
            """)
    List<AttendanceLog> findByUserIdAndDateRangeOrderByDateAsc(
            @Param("userId") Long userId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    @Query("""
            select l.user.id, count(l)
            from AttendanceLog l
            where l.date between :start and :end
              and l.mediaUrls is not null
              and l.mediaUrls <> ''
            group by l.user.id
            """)
    List<Object[]> countMediaLogsByUserBetween(
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    @Query("""
            select l.user.id, count(l)
            from AttendanceLog l
            where l.user.id in :userIds
              and l.didWorkout = true
              and l.date between :start and :end
            group by l.user.id
            """)
    List<Object[]> countWorkoutByUserIdsAndDateBetween(
            @Param("userIds") List<Long> userIds,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );
}
