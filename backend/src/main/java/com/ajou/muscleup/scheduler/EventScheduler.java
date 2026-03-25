package com.ajou.muscleup.scheduler;

import com.ajou.muscleup.service.EventService;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EventScheduler {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final EventService eventService;

    @Scheduled(cron = "0 10 0 * * *", zone = "Asia/Seoul")
    public void refreshEventStatuses() {
        eventService.refreshStatusesAndFinalize(LocalDate.now(KST));
    }
}
