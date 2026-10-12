package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 러닝 기록. 지금을 2026-10-15(목) 12:00 KST 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RunTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 15);

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(TODAY.atTime(12, 0).atZone(TimeConfig.KST).toInstant(), TimeConfig.KST);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AttendanceLogRepository attendanceLogs;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("run-alice@test.local");
        bob = save("run-bob@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 9)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions run(User u, String json) throws Exception {
        return mvc.perform(post("/api/runs").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    // 10:00 ~ 10:30 KST, 달린 시간 27:20(멈춤 2분 40초), 5.2km, 1km 구간 5개
    private static final String FIVE_K = """
            {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:30:00Z","durationSec":1640,"distanceM":5200,
             "splits":[330,320,310,300,305],"source":"GPS","checkAttendance":true}""";

    @Test
    void saveRecordsPointsAndAttendance() throws Exception {
        String body = run(alice, FIVE_K)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.run.date").value("2026-10-15"))
                .andExpect(jsonPath("$.run.startedAt").value("2026-10-15T10:00:00"))
                .andExpect(jsonPath("$.run.paceSec").value(315))
                .andExpect(jsonPath("$.run.splits.length()").value(5))
                .andExpect(jsonPath("$.run.best1kSec").value(300))
                .andExpect(jsonPath("$.run.best5kSec").value(1565))
                .andExpect(jsonPath("$.run.best10kSec").doesNotExist())
                // 첫 러닝: 거리 · 1km · 5km 세 기록, 점수는 하루 10점까지
                .andExpect(jsonPath("$.records.length()").value(3))
                .andExpect(jsonPath("$.records[0].type").value("DISTANCE"))
                .andExpect(jsonPath("$.records[0].previous").doesNotExist())
                .andExpect(jsonPath("$.points").value(10))
                .andExpect(jsonPath("$.attendance.created").value(true))
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(body, "$.run.id");
        assertThat(attendanceLogs.findByUserAndDate(alice, TODAY).orElseThrow().getWorkoutTypes()).isEqualTo("cardio");
        assertThat(attendanceLogs.findByUserAndDate(alice, TODAY).orElseThrow().getMemo()).startsWith("러닝 5.20km · 27분");

        // 같은 날 3km 를 더 빨리: 1km 기록만, 오늘 점수 한도를 다 써서 0점, 출석은 그대로
        run(alice, """
                {"startedAt":"2026-10-15T02:00:00Z","endedAt":"2026-10-15T02:16:00Z","durationSec":900,"distanceM":3050,
                 "splits":[295,290,300],"checkAttendance":true}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.run.source").value("GPS"))
                .andExpect(jsonPath("$.records.length()").value(1))
                .andExpect(jsonPath("$.records[0].type").value("K1"))
                .andExpect(jsonPath("$.records[0].previous").value(300))
                .andExpect(jsonPath("$.points").value(0))
                .andExpect(jsonPath("$.attendance.created").value(false));

        // 러닝머신 직접 입력: 구간 없음 → 속도 기록 비교 없이 거리 기록만
        run(alice, """
                {"startedAt":"2026-10-15T00:00:00Z","endedAt":"2026-10-15T01:00:00Z","durationSec":3500,"distanceM":10000,
                 "splits":[300,300],"source":"MANUAL"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.run.splits.length()").value(0))
                .andExpect(jsonPath("$.run.best10kSec").doesNotExist())
                .andExpect(jsonPath("$.records.length()").value(1))
                .andExpect(jsonPath("$.records[0].type").value("DISTANCE"));

        mvc.perform(get("/api/runs/records").with(as(alice)))
                .andExpect(jsonPath("$.longestM").value(10000))
                .andExpect(jsonPath("$.best1kSec").value(290))
                .andExpect(jsonPath("$.best5kSec").value(1565))
                .andExpect(jsonPath("$.best10kSec").doesNotExist())
                .andExpect(jsonPath("$.weekDistanceM").value(18250))
                .andExpect(jsonPath("$.weekRuns").value(3))
                .andExpect(jsonPath("$.monthRuns").value(3));
        mvc.perform(get("/api/runs?month=2026-10").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].distanceM").value(3050)); // 최근 순
        mvc.perform(get("/api/runs?month=2026-09").with(as(alice))).andExpect(jsonPath("$.length()").value(0));

        // 남의 것은 못 보고 못 지움
        mvc.perform(get("/api/runs/" + id).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/runs/" + id).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(get("/api/runs/" + id).with(as(alice))).andExpect(jsonPath("$.splits[3]").value(300));
        mvc.perform(delete("/api/runs/" + id).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/runs/records").with(as(alice))).andExpect(jsonPath("$.best5kSec").doesNotExist());
        mvc.perform(get("/api/runs/records").with(as(bob))).andExpect(jsonPath("$.totalDistanceM").value(0));
    }

    @Test
    void validation() throws Exception {
        String t = "\"startedAt\":\"2026-10-15T01:00:00Z\",\"endedAt\":\"2026-10-15T01:30:00Z\"";
        // 너무 빠름(5km 10분 = 1km 2분)
        run(alice, "{" + t + ",\"durationSec\":600,\"distanceM\":5000,\"splits\":[120,120,120,120,120]}").andExpect(status().isBadRequest());
        // 구간 수가 거리와 다름
        run(alice, "{" + t + ",\"durationSec\":1500,\"distanceM\":5000,\"splits\":[300]}").andExpect(status().isBadRequest());
        // 구간 합이 시간보다 김
        run(alice, "{" + t + ",\"durationSec\":700,\"distanceM\":2000,\"splits\":[400,400]}").andExpect(status().isBadRequest());
        // 너무 짧은 거리 · 시간
        run(alice, "{" + t + ",\"durationSec\":600,\"distanceM\":50}").andExpect(status().isBadRequest());
        run(alice, "{" + t + ",\"durationSec\":30,\"distanceM\":150}").andExpect(status().isBadRequest());
        // 달린 시간이 시작 ~ 끝보다 김
        run(alice, "{" + t + ",\"durationSec\":2400,\"distanceM\":5000,\"splits\":[480,480,480,480,480]}").andExpect(status().isBadRequest());
        // 미래(지금은 03:00Z)
        run(alice, "{\"startedAt\":\"2026-10-15T03:00:00Z\",\"endedAt\":\"2026-10-15T03:30:00Z\",\"durationSec\":1500,\"distanceM\":5000,"
                + "\"source\":\"MANUAL\"}").andExpect(status().isBadRequest());
        // 1km 미만은 거리 기록 아님
        run(alice, "{" + t + ",\"durationSec\":400,\"distanceM\":900,\"splits\":[]}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.records.length()").value(0))
                .andExpect(jsonPath("$.points").value(0));
        mvc.perform(get("/api/runs")).andExpect(status().is4xxClientError());
    }
}
