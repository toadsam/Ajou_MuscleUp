package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymVisibility;
import java.util.Collection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CmsEventRepository extends JpaRepository<CmsEvent, Long> {
    // 공개 소식. q 는 null 대신 빈 문자열(Postgres 가 null 파라미터를 bytea 로 보고 lower() 에서 실패한다)

    /** 광장: 앱 전체 공지 + 찾기에 보이는 짐(운영 중 · 공개)의 소식 */
    @Query("""
      select e from CmsEvent e left join e.gym g
      where e.status in :statuses
        and lower(e.title) like lower(concat('%', :q, '%'))
        and (g is null or (g.status = :active and g.visibility = :open))
      """)
    Page<CmsEvent> findPublicSquare(
            @Param("statuses") Collection<CmsEventStatus> statuses,
            @Param("q") String q,
            @Param("active") GymStatus active,
            @Param("open") GymVisibility open,
            Pageable pageable
    );

    /** 한 짐: 그 짐 소식 + 앱 전체 공지 */
    @Query("""
      select e from CmsEvent e left join e.gym g
      where e.status in :statuses
        and lower(e.title) like lower(concat('%', :q, '%'))
        and (g is null or g.id = :gymId)
      """)
    Page<CmsEvent> findPublicInGym(
            @Param("statuses") Collection<CmsEventStatus> statuses,
            @Param("q") String q,
            @Param("gymId") Long gymId,
            Pageable pageable
    );

    @Query("""
      select e from CmsEvent e
      where (:status is null or e.status = :status)
      """)
    Page<CmsEvent> findAdmin(
            @Param("status") CmsEventStatus status,
            Pageable pageable
    );

    @Query("""
      select e from CmsEvent e
      where (:status is null or e.status = :status)
        and lower(e.title) like lower(concat('%', :q, '%'))
      """)
    Page<CmsEvent> findAdminWithQuery(
            @Param("status") CmsEventStatus status,
            @Param("q") String q,
            Pageable pageable
    );

    @Modifying
    @Query("update CmsEvent e set e.viewCount = e.viewCount + 1 where e.id = :id")
    int incrementView(@Param("id") Long id);

    @Modifying
    @Query("update CmsEvent e set e.clickCount = e.clickCount + 1 where e.id = :id")
    int incrementClick(@Param("id") Long id);
}
