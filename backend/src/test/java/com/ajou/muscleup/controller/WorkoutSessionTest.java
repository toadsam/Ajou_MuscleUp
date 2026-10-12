package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
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

/** 운동 세션(번핏처럼). 지금을 2026-10-15 12:00 KST 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class WorkoutSessionTest {

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
    @Autowired UserBodyStatsRepository bodyStats;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("ws-alice@test.local");
        bob = save("ws-bob@test.local");
        bodyStats.save(UserBodyStats.builder().user(alice).gender(Gender.MALE).heightCm(175).weightKg(70.0).squatKg(100.0).build());
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions session(User u, String json) throws Exception {
        return mvc.perform(post("/api/workouts").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    // 10:00 ~ 10:52 KST (UTC 로 보내도 한국 시간으로 저장)
    private static final String FULL = """
            {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:52:00Z","checkAttendance":true,
             "exercises":[
               {"exercise":"SQUAT","sets":[{"weightKg":100,"reps":5},{"weightKg":100,"reps":5},{"weightKg":105,"reps":3}]},
               {"exercise":"PULL_UP","sets":[{"weightKg":0,"reps":8},{"weightKg":10,"reps":5}]}
             ]}""";

    @Test
    void saveMakesLiftRecordsPrsAndAttendance() throws Exception {
        String body = session(alice, FULL)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.session.summary.date").value("2026-10-15"))
                .andExpect(jsonPath("$.session.summary.startedAt").value("2026-10-15T10:00:00"))
                .andExpect(jsonPath("$.session.summary.durationSec").value(3120))
                .andExpect(jsonPath("$.session.summary.totalSets").value(5))
                .andExpect(jsonPath("$.session.summary.totalVolume").value(1365.0))
                .andExpect(jsonPath("$.session.exercises[0].label").value("스쿼트"))
                .andExpect(jsonPath("$.session.exercises[1].bodyweight").value(true))
                // 스쿼트는 가장 좋은 세트(100×5 → 116.7)로 개인 최고 · 3대, 턱걸이(맨몸)는 기록만
                .andExpect(jsonPath("$.prs.length()").value(1))
                .andExpect(jsonPath("$.prs[0].e1rm").value(116.7))
                .andExpect(jsonPath("$.statUpdates[0].after").value(116.5))
                .andExpect(jsonPath("$.points").value(5))
                .andExpect(jsonPath("$.attendance.created").value(true))
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(body, "$.session.summary.id");

        mvc.perform(get("/api/lifts").with(as(alice)))
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].sets").value(3));
        mvc.perform(get("/api/attendance?month=2026-10").with(as(alice)))
                .andExpect(jsonPath("$[0].didWorkout").value(true));
        mvc.perform(get("/api/workouts/previous?exercise=SQUAT").with(as(alice)))
                .andExpect(jsonPath("$.date").value("2026-10-15"))
                .andExpect(jsonPath("$.sets.length()").value(3))
                .andExpect(jsonPath("$.sets[2].weightKg").value(105.0));
        mvc.perform(get("/api/workouts/previous?exercise=BENCH").with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/workouts?month=2026-10").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].exercises[1]").value("턱걸이"));

        // 두 번째 세션: 이미 출석했으면 출석은 그대로, 같은 무게면 개인 최고 아님
        session(alice, FULL.replace("01:00:00Z", "02:00:00Z").replace("01:52:00Z", "02:30:00Z"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attendance.created").value(false))
                .andExpect(jsonPath("$.prs.length()").value(0));

        // 다른 사람은 못 보고 못 지움, 지우면 그 세션의 운동 기록도
        mvc.perform(get("/api/workouts/" + id).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/workouts/" + id).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/workouts/" + id).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/lifts").with(as(alice))).andExpect(jsonPath("$.entries.length()").value(1));
        assertThat(bodyStats.findByUser(alice).orElseThrow().getSquatKg()).isEqualTo(116.5);
    }

    @Test
    void validation() throws Exception {
        String ok = "\"startedAt\":\"2026-10-15T01:00:00Z\",\"endedAt\":\"2026-10-15T01:30:00Z\"";
        session(alice, "{" + ok + ",\"exercises\":[{\"exercise\":\"SQUAT\",\"sets\":[{\"weightKg\":0,\"reps\":5}]}]}")
                .andExpect(status().isBadRequest());
        session(alice, "{" + ok + ",\"exercises\":[{\"exercise\":\"CURLZ\",\"sets\":[{\"weightKg\":10,\"reps\":5}]}]}")
                .andExpect(status().isBadRequest());
        session(alice, "{" + ok + ",\"exercises\":[{\"exercise\":\"SQUAT\",\"sets\":[]}]}")
                .andExpect(status().isBadRequest());
        session(alice, "{\"startedAt\":\"2026-10-15T01:00:00Z\",\"endedAt\":\"2026-10-15T01:00:30Z\","
                + "\"exercises\":[{\"exercise\":\"SQUAT\",\"sets\":[{\"weightKg\":60,\"reps\":5}]}]}")
                .andExpect(status().isBadRequest());
        // 미래(지금은 03:00Z)
        session(alice, "{\"startedAt\":\"2026-10-15T03:00:00Z\",\"endedAt\":\"2026-10-15T04:00:00Z\","
                + "\"exercises\":[{\"exercise\":\"SQUAT\",\"sets\":[{\"weightKg\":60,\"reps\":5}]}]}")
                .andExpect(status().isBadRequest());
        // 맨몸 종목은 빠른 기록에서 받지 않는다
        mvc.perform(post("/api/lifts").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"exercise\":\"PULL_UP\",\"weightKg\":10,\"reps\":5}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/workouts")).andExpect(status().is4xxClientError());
    }
}
