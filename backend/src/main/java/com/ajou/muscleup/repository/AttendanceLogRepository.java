package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.User;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Query("""
            select l
            from AttendanceLog l
            join l.user u
            where (:query is null
                    or lower(u.email) like lower(concat('%', :query, '%'))
                    or lower(u.nickname) like lower(concat('%', :query, '%')))
              and (:didWorkout is null or l.didWorkout = :didWorkout)
              and (:shared is null or l.shared = :shared)
              and (:fromDate is null or l.date >= :fromDate)
              and (:toDate is null or l.date <= :toDate)
            order by l.updatedAt desc
            """)
    Page<AttendanceLog> searchForAdmin(
            @Param("query") String query,
            @Param("didWorkout") Boolean didWorkout,
            @Param("shared") Boolean shared,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            Pageable pageable
    );

    // 연속 출석 계산용: 기간 안의 (날짜, 운동 여부)만 한 번에 읽는다. 하루마다 한 번씩 조회하던 것을 대신한다.
    @Query("""
            select l.date, l.didWorkout
            from AttendanceLog l
            where l.user.id = :userId
              and l.date between :start and :end
            """)
    List<Object[]> findDateFlagsByUserIdAndDateRange(
            @Param("userId") Long userId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    // 주간 연속 출석 랭킹용: 기간 안의 운동한 날을 회원 닉네임과 함께 한 번에 읽는다(회원마다 조회하던 N+1 대체).
    @Query("""
            select u.id, u.nickname, l.date
            from AttendanceLog l
            join l.user u
            where l.didWorkout = true
              and l.date between :start and :end
            """)
    List<Object[]> findWorkoutDaysWithNicknameBetween(
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    // 응원·신고 수는 읽고-더하고-저장하면 동시 요청에서 숫자가 빠진다. DB 에서 한 번에 +1 한다.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AttendanceLog l set l.cheerCount = l.cheerCount + 1 where l.id = :id")
    int incrementCheerCount(@Param("id") Long id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AttendanceLog l set l.reportCount = l.reportCount + 1 where l.id = :id")
    int incrementReportCount(@Param("id") Long id);
}
