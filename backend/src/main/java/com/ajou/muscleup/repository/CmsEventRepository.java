package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import java.util.Collection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CmsEventRepository extends JpaRepository<CmsEvent, Long> {
    @Query("""
      select e from CmsEvent e
      where e.status in :statuses
        and (:q is null or lower(e.title) like lower(concat('%', :q, '%')))
      """)
    Page<CmsEvent> findPublic(
            @Param("statuses") Collection<CmsEventStatus> statuses,
            @Param("q") String q,
            Pageable pageable
    );

    @Query("""
      select e from CmsEvent e
      where (:status is null or e.status = :status)
        and (:q is null or lower(e.title) like lower(concat('%', :q, '%')))
      """)
    Page<CmsEvent> findAdmin(
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
