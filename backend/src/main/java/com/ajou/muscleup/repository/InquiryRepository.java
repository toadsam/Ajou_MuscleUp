package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Inquiry;
import com.ajou.muscleup.entity.InquiryStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InquiryRepository extends JpaRepository<Inquiry, Long> {

    @Query("""
            select i
            from Inquiry i
            where (:chairmanOnly = false or lower(coalesce(i.page, '')) like '%chairman-feedback%')
              and (
                :query is null
                or lower(coalesce(i.name, '')) like lower(concat('%', :query, '%'))
                or lower(coalesce(i.email, '')) like lower(concat('%', :query, '%'))
                or lower(coalesce(i.message, '')) like lower(concat('%', :query, '%'))
                or lower(coalesce(i.page, '')) like lower(concat('%', :query, '%'))
              )
              and (:status is null or i.status = :status)
            """)
    Page<Inquiry> searchForAdmin(
            @Param("query") String query,
            @Param("chairmanOnly") boolean chairmanOnly,
            @Param("status") InquiryStatus status,
            Pageable pageable
    );
}
