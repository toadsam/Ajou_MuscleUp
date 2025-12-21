package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.AnalyticsEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, Long> {

    interface CountByAction {
        String getAction();
        Long getCount();
    }

    interface CountByPage {
        String getPage();
        Long getCount();
    }

    @Query("select e.action as action, count(e) as count from AnalyticsEvent e where e.createdAt >= :since group by e.action")
    List<CountByAction> countByActionSince(@Param("since") LocalDateTime since);

    @Query("select e.page as page, count(e) as count from AnalyticsEvent e where e.createdAt >= :since group by e.page order by count(e) desc")
    List<CountByPage> countByPageSince(@Param("since") LocalDateTime since);
}
