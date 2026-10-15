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

/** 내가 추가한 운동(필라테스 · 수영 등) — 시간 + 메모 기록. 지금을 2026-10-15(목) 12:00 KST 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ActivityTest {

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
        alice = save("act-alice@test.local");
        bob = save("act-bob@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 9)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions add(User u, String json) throws Exception {
        return mvc.perform(post("/api/activities").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long addId(User u, String name, String category) throws Exception {
        String body = add(u, "{\"name\":\"" + name + "\",\"category\":\"" + category + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private ResultActions log(User u, long id, String json) throws Exception {
        return mvc.perform(post("/api/activities/" + id + "/logs").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void addListAndRemove() throws Exception {
        long pilates = addId(alice, "  필라테스  ", "STRETCH");
        addId(alice, "수영", "CARDIO");
        mvc.perform(get("/api/activities").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("필라테스"))
                .andExpect(jsonPath("$[0].category").value("STRETCH"));
        // 같은 이름 · 빈 이름 · 21자 · 모르는 종류
        add(alice, "{\"name\":\"필라테스\",\"category\":\"STRETCH\"}").andExpect(status().isConflict());
        add(alice, "{\"name\":\" \",\"category\":\"CARDIO\"}").andExpect(status().isBadRequest());
        add(alice, "{\"name\":\"" + "가".repeat(21) + "\",\"category\":\"CARDIO\"}").andExpect(status().isBadRequest());
        add(alice, "{\"name\":\"요가\",\"category\":\"DANCE\"}").andExpect(status().isBadRequest());
        // 남의 것은 못 지운다, 내 것은 고르기에서 빠진다
        mvc.perform(delete("/api/activities/" + pilates).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/activities/" + pilates).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/activities").with(as(alice))).andExpect(jsonPath("$.length()").value(1));
        // 지운 이름은 다시 추가할 수 있다
        addId(alice, "필라테스", "STRETCH");
        // 로그인 필요
        mvc.perform(get("/api/activities")).andExpect(status().is4xxClientError());
    }

    @Test
    void logWithAttendance() throws Exception {
        long swim = addId(alice, "수영", "CARDIO");
        log(alice, swim, "{\"durationSec\":2700,\"note\":\"자유형 1km\",\"checkAttendance\":true}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.log.name").value("수영"))
                .andExpect(jsonPath("$.log.durationSec").value(2700))
                .andExpect(jsonPath("$.log.date").value("2026-10-15"))
                .andExpect(jsonPath("$.log.startedAt").value("2026-10-15T11:15:00"))
                .andExpect(jsonPath("$.attendance.created").value(true));
        var att = attendanceLogs.findByUserAndDate(alice, TODAY).orElseThrow();
        assertThat(att.getMemo()).isEqualTo("수영 45분");
        // 출석은 한 번만
        log(alice, swim, "{\"durationSec\":600,\"checkAttendance\":true}").andExpect(jsonPath("$.attendance.created").value(false));
        mvc.perform(get("/api/activities/logs?month=2026-10").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].note").value("자유형 1km"));
        mvc.perform(get("/api/activities/logs").with(as(bob))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void logRejectsBadInput() throws Exception {
        long swim = addId(alice, "수영", "CARDIO");
        log(alice, swim, "{\"durationSec\":30}").andExpect(status().isBadRequest());
        log(alice, swim, "{\"durationSec\":43201}").andExpect(status().isBadRequest());
        log(alice, swim, "{\"durationSec\":600,\"endedAt\":\"2026-10-15T13:00:00+09:00\"}").andExpect(status().isBadRequest());
        log(alice, swim, "{\"durationSec\":600,\"endedAt\":\"2026-10-13T12:00:00+09:00\"}").andExpect(status().isBadRequest());
        // 끝난 시각을 주면 그 앞으로 시간을 잡는다(어제 저녁 운동)
        log(alice, swim, "{\"durationSec\":3600,\"endedAt\":\"2026-10-14T21:00:00+09:00\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.log.date").value("2026-10-14"));
        // 남의 운동에는 못 적는다
        log(bob, swim, "{\"durationSec\":600}").andExpect(status().isNotFound());
        // 지운 운동에는 못 적는다
        mvc.perform(delete("/api/activities/" + swim).with(as(alice))).andExpect(status().isNoContent());
        log(alice, swim, "{\"durationSec\":600}").andExpect(status().isNotFound());
    }

    @Test
    void deleteLogOnlyMine() throws Exception {
        long swim = addId(alice, "수영", "CARDIO");
        String body = log(alice, swim, "{\"durationSec\":600}").andReturn().getResponse().getContentAsString();
        long logId = ((Number) JsonPath.read(body, "$.log.id")).longValue();
        mvc.perform(delete("/api/activities/logs/" + logId).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/activities/logs/" + logId).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/activities/logs").with(as(alice))).andExpect(jsonPath("$.length()").value(0));
    }
}
