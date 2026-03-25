package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.eventcms.EventAdminListResponse;
import com.ajou.muscleup.dto.eventcms.EventDetailResponse;
import com.ajou.muscleup.dto.eventcms.EventListItemResponse;
import com.ajou.muscleup.dto.eventcms.EventSaveRequest;
import com.ajou.muscleup.dto.eventcms.EventViewClickResponse;
import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import com.ajou.muscleup.repository.CmsEventRepository;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class CmsEventServiceImpl implements CmsEventService {
    private static final Set<CmsEventStatus> PUBLIC_STATUSES =
            Set.of(CmsEventStatus.ACTIVE, CmsEventStatus.SCHEDULED, CmsEventStatus.ENDED);

    private final CmsEventRepository cmsEventRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<EventListItemResponse> getPublicList(CmsEventStatus status, String q, Pageable pageable) {
        if (status != null && !PUBLIC_STATUSES.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only public statuses are allowed");
        }
        Set<CmsEventStatus> statuses = status == null ? PUBLIC_STATUSES : Set.of(status);
        return cmsEventRepository
                .findPublic(statuses, normalizeQuery(q), withDefaultSort(pageable))
                .map(EventListItemResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public EventDetailResponse getPublicDetail(Long id) {
        CmsEvent event = getByIdOrThrow(id);
        if (!PUBLIC_STATUSES.contains(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found");
        }
        return EventDetailResponse.from(event);
    }

    @Override
    @Transactional
    public EventViewClickResponse increaseView(Long id) {
        int updated = cmsEventRepository.incrementView(id);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found");
        }
        CmsEvent event = getByIdOrThrow(id);
        return new EventViewClickResponse(event.getId(), event.getViewCount());
    }

    @Override
    @Transactional
    public EventViewClickResponse increaseClick(Long id) {
        int updated = cmsEventRepository.incrementClick(id);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found");
        }
        CmsEvent event = getByIdOrThrow(id);
        return new EventViewClickResponse(event.getId(), event.getClickCount());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<EventAdminListResponse> getAdminList(CmsEventStatus status, String q, Pageable pageable) {
        return cmsEventRepository
                .findAdmin(status, normalizeQuery(q), withDefaultSort(pageable))
                .map(EventAdminListResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public EventDetailResponse getAdminDetail(Long id) {
        return EventDetailResponse.from(getByIdOrThrow(id));
    }

    @Override
    @Transactional
    public EventDetailResponse create(EventSaveRequest request, Long adminId) {
        validatePeriod(request);
        CmsEvent event = CmsEvent.builder()
                .title(request.getTitle().trim())
                .summary(request.getSummary().trim())
                .content(request.getContent())
                .thumbnailUrl(request.getThumbnailUrl().trim())
                .bannerUrl(blankToNull(request.getBannerUrl()))
                .startAt(request.getStartAt())
                .endAt(request.getEndAt())
                .status(request.getStatus())
                .isMainBanner(request.isMainBanner())
                .isPinned(request.isPinned())
                .priority(request.getPriority())
                .ctaText(request.getCtaText().trim())
                .ctaLink(request.getCtaLink().trim())
                .viewCount(0L)
                .clickCount(0L)
                .createdBy(adminId)
                .tags(request.getTags() == null ? List.of() : request.getTags())
                .build();
        return EventDetailResponse.from(cmsEventRepository.save(event));
    }

    @Override
    @Transactional
    public EventDetailResponse update(Long id, EventSaveRequest request) {
        validatePeriod(request);
        CmsEvent event = getByIdOrThrow(id);
        event.setTitle(request.getTitle().trim());
        event.setSummary(request.getSummary().trim());
        event.setContent(request.getContent());
        event.setThumbnailUrl(request.getThumbnailUrl().trim());
        event.setBannerUrl(blankToNull(request.getBannerUrl()));
        event.setStartAt(request.getStartAt());
        event.setEndAt(request.getEndAt());
        event.setStatus(request.getStatus());
        event.setMainBanner(request.isMainBanner());
        event.setPinned(request.isPinned());
        event.setPriority(request.getPriority());
        event.setCtaText(request.getCtaText().trim());
        event.setCtaLink(request.getCtaLink().trim());
        event.setTags(request.getTags() == null ? List.of() : request.getTags());
        return EventDetailResponse.from(cmsEventRepository.save(event));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        cmsEventRepository.delete(getByIdOrThrow(id));
    }

    @Override
    @Transactional
    public EventDetailResponse patchStatus(Long id, CmsEventStatus status) {
        CmsEvent event = getByIdOrThrow(id);
        event.setStatus(status);
        return EventDetailResponse.from(cmsEventRepository.save(event));
    }

    @Override
    @Transactional
    public EventDetailResponse patchMainBanner(Long id, boolean value) {
        CmsEvent event = getByIdOrThrow(id);
        event.setMainBanner(value);
        return EventDetailResponse.from(cmsEventRepository.save(event));
    }

    @Override
    @Transactional
    public EventDetailResponse patchPin(Long id, boolean value) {
        CmsEvent event = getByIdOrThrow(id);
        event.setPinned(value);
        return EventDetailResponse.from(cmsEventRepository.save(event));
    }

    private Pageable withDefaultSort(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable;
        }
        return PageRequest.of(
                pageable.getPageNumber(),
                pageable.getPageSize(),
                Sort.by(
                        Sort.Order.desc("isPinned"),
                        Sort.Order.desc("priority"),
                        Sort.Order.desc("startAt")
                )
        );
    }

    private String normalizeQuery(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        return q.trim();
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private void validatePeriod(EventSaveRequest request) {
        if (request.getStartAt().isAfter(request.getEndAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startAt must be <= endAt");
        }
    }

    private CmsEvent getByIdOrThrow(Long id) {
        return cmsEventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
    }
}
