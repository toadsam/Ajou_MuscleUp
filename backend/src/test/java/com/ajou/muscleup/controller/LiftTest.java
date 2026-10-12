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

/** 운동 기록 · 개인 최고(PR F). 오늘을 2026-10-15 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LiftTest {

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
        alice = save("lf-alice@test.local");
        bob = save("lf-bob@test.local");
        bodyStats.save(UserBodyStats.builder().user(alice).gender(Gender.MALE).heightCm(175).weightKg(70.0)
                .squatKg(100.0).benchKg(70.0).deadliftKg(130.0).build());
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions lift(User u, String json) throws Exception {
        return mvc.perform(post("/api/lifts").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void personalBestsPointsAndBigThreeUpdate() throws Exception {
        // 첫 스쿼트 100×5 → 추정 1RM 116.7, 첫 기록도 개인 최고(+5), 3대 스쿼트 100 → 116.5
        lift(alice, "{\"exercise\":\"SQUAT\",\"weightKg\":100,\"reps\":5,\"sets\":3}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entry.label").value("스쿼트"))
                .andExpect(jsonPath("$.entry.e1rm").value(116.7))
                .andExpect(jsonPath("$.pr.first").value(true))
                .andExpect(jsonPath("$.points").value(5))
                .andExpect(jsonPath("$.statUpdate.before").value(100.0))
                .andExpect(jsonPath("$.statUpdate.after").value(116.5));

        // 더 낮으면 그대로
        lift(alice, "{\"exercise\":\"SQUAT\",\"weightKg\":100,\"reps\":3}")
                .andExpect(jsonPath("$.pr").doesNotExist())
                .andExpect(jsonPath("$.points").value(0))
                .andExpect(jsonPath("$.statUpdate").doesNotExist());

        // 같은 날 또 깨면 축하는 하지만 점수는 종목마다 하루 한 번
        lift(alice, "{\"exercise\":\"SQUAT\",\"weightKg\":105,\"reps\":5}")
                .andExpect(jsonPath("$.pr.previousE1rm").value(116.7))
                .andExpect(jsonPath("$.pr.e1rm").value(122.5))
                .andExpect(jsonPath("$.points").value(0))
                .andExpect(jsonPath("$.statUpdate.after").value(122.5));

        // 10회는 3대에 반영하지 않는다(추정이 부풀어서)
        lift(alice, "{\"exercise\":\"BENCH\",\"weightKg\":60,\"reps\":10}")
                .andExpect(jsonPath("$.points").value(5))
                .andExpect(jsonPath("$.statUpdate").doesNotExist());
        lift(alice, "{\"exercise\":\"DEADLIFT\",\"weightKg\":140,\"reps\":1}")
                .andExpect(jsonPath("$.points").value(5))
                .andExpect(jsonPath("$.statUpdate.after").value(140.0));
        // 하루 3종목까지 점수
        lift(alice, "{\"exercise\":\"OHP\",\"weightKg\":40,\"reps\":5}")
                .andExpect(jsonPath("$.pr.first").value(true))
                .andExpect(jsonPath("$.points").value(0));

        UserBodyStats s = bodyStats.findByUser(alice).orElseThrow();
        assertThat(s.getSquatKg()).isEqualTo(122.5);
        assertThat(s.getBenchKg()).isEqualTo(70.0);
        assertThat(s.getDeadliftKg()).isEqualTo(140.0);

        mvc.perform(get("/api/lifts/bests").with(as(alice)))
                .andExpect(jsonPath("$[0].exercise").value("SQUAT"))
                .andExpect(jsonPath("$[0].e1rm").value(122.5))
                .andExpect(jsonPath("$[0].maxWeightKg").value(105.0));
        mvc.perform(get("/api/lifts/history?exercise=SQUAT").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].date").value("2026-10-15"))
                .andExpect(jsonPath("$[0].e1rm").value(122.5));
        mvc.perform(get("/api/lifts").with(as(alice)))
                .andExpect(jsonPath("$.entries.length()").value(6));
    }

    @Test
    void validationOwnershipAndNoStats() throws Exception {
        lift(alice, "{\"exercise\":\"SQUAT\",\"weightKg\":0,\"reps\":5}").andExpect(status().isBadRequest());
        lift(alice, "{\"exercise\":\"SQUAT\",\"weightKg\":100,\"reps\":31}").andExpect(status().isBadRequest());
        lift(alice, "{\"exercise\":\"CURL\",\"weightKg\":10,\"reps\":5}").andExpect(status().isBadRequest());
        lift(alice, "{\"date\":\"2026-10-16\",\"exercise\":\"SQUAT\",\"weightKg\":100,\"reps\":5}").andExpect(status().isBadRequest());
        lift(alice, "{\"date\":\"2026-10-07\",\"exercise\":\"SQUAT\",\"weightKg\":100,\"reps\":5}").andExpect(status().isBadRequest());
        lift(alice, "{\"date\":\"2026-10-08\",\"exercise\":\"SQUAT\",\"weightKg\":90,\"reps\":5}").andExpect(status().isCreated());

        // 신체 정보가 없으면 3대 갱신 없이 기록만
        String body = lift(bob, "{\"exercise\":\"BENCH\",\"weightKg\":80,\"reps\":1}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pr.first").value(true))
                .andExpect(jsonPath("$.statUpdate").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        Integer bobEntry = JsonPath.read(body, "$.entry.id");

        // 다른 사람 기록은 못 지운다, 내 기록은 지워도 3대는 그대로
        mvc.perform(delete("/api/lifts/" + bobEntry).with(as(alice))).andExpect(status().isNotFound());
        String mine = lift(alice, "{\"exercise\":\"BENCH\",\"weightKg\":80,\"reps\":1}").andReturn().getResponse().getContentAsString();
        Integer aliceEntry = JsonPath.read(mine, "$.entry.id");
        assertThat(bodyStats.findByUser(alice).orElseThrow().getBenchKg()).isEqualTo(80.0);
        mvc.perform(delete("/api/lifts/" + aliceEntry).with(as(alice))).andExpect(status().isNoContent());
        assertThat(bodyStats.findByUser(alice).orElseThrow().getBenchKg()).isEqualTo(80.0);
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/lifts")).andExpect(status().is4xxClientError());
        mvc.perform(post("/api/lifts").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().is4xxClientError());
    }
}
