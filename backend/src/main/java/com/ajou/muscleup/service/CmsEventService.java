package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.eventcms.EventAdminListResponse;
import com.ajou.muscleup.dto.eventcms.EventDetailResponse;
import com.ajou.muscleup.dto.eventcms.EventListItemResponse;
import com.ajou.muscleup.dto.eventcms.EventSaveRequest;
import com.ajou.muscleup.dto.eventcms.EventViewClickResponse;
import com.ajou.muscleup.entity.CmsEventStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CmsEventService {
    Page<EventListItemResponse> getPublicList(CmsEventStatus status, String q, Pageable pageable);

    EventDetailResponse getPublicDetail(Long id);

    EventViewClickResponse increaseView(Long id);

    EventViewClickResponse increaseClick(Long id);

    Page<EventAdminListResponse> getAdminList(CmsEventStatus status, String q, Pageable pageable);

    EventDetailResponse getAdminDetail(Long id);

    EventDetailResponse create(EventSaveRequest request, Long adminId);

    EventDetailResponse update(Long id, EventSaveRequest request);

    void delete(Long id);

    EventDetailResponse patchStatus(Long id, CmsEventStatus status);

    EventDetailResponse patchMainBanner(Long id, boolean value);

    EventDetailResponse patchPin(Long id, boolean value);
}
