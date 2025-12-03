package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.analytics.AnalyticsEventRequest;
import com.ajou.muscleup.dto.analytics.AnalyticsEventResponse;
import com.ajou.muscleup.dto.analytics.AnalyticsSummaryResponse;
import com.ajou.muscleup.entity.AnalyticsEvent;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AnalyticsEventRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class AnalyticsService {

    private final AnalyticsEventRepository analyticsEventRepository;
    private final UserRepository userRepository;

    public void recordEvent(String email, AnalyticsEventRequest req) {
        User user = null;
        if (email != null && !email.isBlank()) {
            user = userRepository.findByEmail(email).orElse(null);
        }
        AnalyticsEvent event = AnalyticsEvent.builder()
                .user(user)
                .page(req.getPage())
                .action(req.getAction())
                .metadata(req.getMetadata())
                .build();
        analyticsEventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public AnalyticsSummaryResponse summarySince(LocalDateTime since) {
        List<AnalyticsEventRepository.CountByAction> byAction = analyticsEventRepository.countByActionSince(since);
        List<AnalyticsEventRepository.CountByPage> byPage = analyticsEventRepository.countByPageSince(since);

        List<AnalyticsSummaryResponse.ActionCountItem> actionItems = byAction.stream()
                .map(r -> new AnalyticsSummaryResponse.ActionCountItem(r.getAction(), r.getCount()))
                .toList();
        List<AnalyticsSummaryResponse.PageCountItem> pageItems = byPage.stream()
                .map(r -> new AnalyticsSummaryResponse.PageCountItem(r.getPage(), r.getCount()))
                .toList();

        return new AnalyticsSummaryResponse(actionItems, pageItems);
    }

    @Transactional(readOnly = true)
    public List<AnalyticsEventResponse> recentEvents(int limit) {
        int pageSize = Math.max(1, Math.min(limit, 500));
        return analyticsEventRepository.findAll(PageRequest.of(0, pageSize, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(e -> new AnalyticsEventResponse(
                        e.getId(),
                        e.getPage(),
                        e.getAction(),
                        e.getMetadata(),
                        e.getUser() != null ? e.getUser().getEmail() : null,
                        e.getUser() != null ? e.getUser().getNickname() : null,
                        e.getCreatedAt()
                ))
                .toList();
    }
}
