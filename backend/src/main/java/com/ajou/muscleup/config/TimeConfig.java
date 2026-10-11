package com.ajou.muscleup.config;

import jakarta.annotation.PostConstruct;
import java.time.Clock;
import java.time.ZoneId;
import java.util.TimeZone;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 서비스의 "오늘"은 한국 시간(Asia/Seoul) 기준이다.
 *
 * - 서버(JVM) 기본 시간대가 UTC 인 배포 환경에서 LocalDate.now() 를 그대로 쓰면
 *   한국 시간 00:00~08:59 사이에는 "어제"로 계산되는 문제가 있었다.
 * - BackendApplication.main 에서 기본 시간대를 먼저 맞추고, 테스트처럼 main 을 거치지 않는
 *   경우를 위해 여기서도 한 번 더 맞춘다.
 * - 날짜 계산이 필요한 서비스는 이 Clock 빈을 주입받아 LocalDate.now(clock) 으로 쓴다.
 */
@Configuration
public class TimeConfig {
    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @PostConstruct
    void applyDefaultTimeZone() {
        TimeZone.setDefault(TimeZone.getTimeZone(KST));
    }

    @Bean
    public Clock clock() {
        return Clock.system(KST);
    }
}
