package com.ajou.muscleup.scheduler;

import com.ajou.muscleup.service.ShadowBossService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 그림자 던전 정산(docs/design/shadow-dungeon.md 2.6): 월요일 00:05 KST 에 지난 주까지 안 쓴 힘을 기본 공격으로 넣는다.
 * 한 주씩 따로 트랜잭션 — 한 사람 것이 실패해도 나머지는 정산된다. 못 돈 경우는 상태를 볼 때 그 사람 것만 따라 정산된다(ShadowBossService.status).
 */
@Component
@RequiredArgsConstructor
public class ShadowScheduler {
    private static final Logger log = LoggerFactory.getLogger(ShadowScheduler.class);

    private final ShadowBossService shadowBossService;

    @Scheduled(cron = "0 5 0 * * MON", zone = "Asia/Seoul")
    public void settleLastWeek() {
        int done = 0;
        for (Long id : shadowBossService.unsettledWeekIds()) {
            try {
                shadowBossService.settleWeek(id);
                done++;
            } catch (RuntimeException e) {
                log.warn("그림자 정산 실패 week={}", id, e);
            }
        }
        if (done > 0) log.info("그림자 정산 {}주", done);
    }
}
