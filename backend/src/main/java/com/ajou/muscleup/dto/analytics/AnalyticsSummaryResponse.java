package com.ajou.muscleup.dto.analytics;

import java.util.List;

public record AnalyticsSummaryResponse(
        List<ActionCountItem> actionCounts,
        List<PageCountItem> pageCounts
) {
    public record ActionCountItem(String action, Long count) {}
    public record PageCountItem(String page, Long count) {}
}
