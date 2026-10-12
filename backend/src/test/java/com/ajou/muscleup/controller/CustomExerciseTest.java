package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.User;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 직접 추가한 종목 · 최근 한 종목. 지금을 2026-10-15 12:00 KST 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CustomExerciseTest {

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

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("cx-alice@test.local");
        bob = save("cx-bob@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions postJson(String url, User u, String body) throws Exception {
        return mvc.perform(post(url).with(as(u)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private String addCustom(User u, String name, String category, boolean bodyweight) throws Exception {
        String body = postJson("/api/lifts/custom", u,
                "{\"name\":\"" + name + "\",\"category\":\"" + category + "\",\"bodyweight\":" + bodyweight + "}")
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.code");
    }

    @Test
    void addUseInLiftsAndSessionsThenDelete() throws Exception {
        String pullover = addCustom(alice, "  케이블   풀오버 ", "BACK", false);
        String lsit = addCustom(alice, "L-sit", "CORE", true);
        mvc.perform(get("/api/lifts/custom").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].label").value("케이블 풀오버"))
                .andExpect(jsonPath("$[0].custom").value(true))
                .andExpect(jsonPath("$[1].bodyweight").value(true));

        // 같은 이름(띄어쓰기 · 대소문자 무시) · 기본 종목 이름 · 빈 이름 · 모르는 부위는 거절
        postJson("/api/lifts/custom", alice, "{\"name\":\"케이블풀오버\",\"category\":\"BACK\"}").andExpect(status().isConflict());
        postJson("/api/lifts/custom", alice, "{\"name\":\"l-SIT\",\"category\":\"CORE\"}").andExpect(status().isConflict());
        postJson("/api/lifts/custom", alice, "{\"name\":\"스쿼트\",\"category\":\"LEGS\"}").andExpect(status().isConflict());
        postJson("/api/lifts/custom", alice, "{\"name\":\"  \",\"category\":\"LEGS\"}").andExpect(status().isBadRequest());
        postJson("/api/lifts/custom", alice, "{\"name\":\"뭔가\",\"category\":\"FEET\"}").andExpect(status().isBadRequest());
        // 다른 사람은 같은 이름을 따로 가질 수 있다
        addCustom(bob, "케이블 풀오버", "BACK", false);

        // 빠른 기록: 첫 기록이면 개인 최고, 최고 기록판엔 기본 종목 뒤에
        postJson("/api/lifts", alice, "{\"exercise\":\"SQUAT\",\"weightKg\":100,\"reps\":5,\"sets\":3}").andExpect(status().isCreated());
        postJson("/api/lifts", alice, "{\"exercise\":\"" + pullover + "\",\"weightKg\":30,\"reps\":12,\"sets\":3}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entry.label").value("케이블 풀오버"))
                .andExpect(jsonPath("$.pr.first").value(true))
                .andExpect(jsonPath("$.statUpdate").doesNotExist());
        mvc.perform(get("/api/lifts/bests").with(as(alice)))
                .andExpect(jsonPath("$[0].exercise").value("SQUAT"))
                .andExpect(jsonPath("$[1].label").value("케이블 풀오버"));
        mvc.perform(get("/api/lifts/history?exercise=" + pullover).with(as(alice))).andExpect(jsonPath("$.length()").value(1));
        // 맨몸 종목은 빠른 기록에 안 됨, 남의 종목은 못 씀
        postJson("/api/lifts", alice, "{\"exercise\":\"" + lsit + "\",\"weightKg\":10,\"reps\":5}").andExpect(status().isBadRequest());
        postJson("/api/lifts", bob, "{\"exercise\":\"" + pullover + "\",\"weightKg\":30,\"reps\":12}").andExpect(status().isBadRequest());

        // 운동 세션: 직접 추가한 종목도 세트 · 이름 · 지난번 값
        postJson("/api/workouts", alice, """
                {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:40:00Z",
                 "exercises":[{"exercise":"%s","sets":[{"weightKg":35,"reps":10}]},{"exercise":"%s","sets":[{"weightKg":0,"reps":20}]}]}"""
                .formatted(pullover, lsit))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.session.summary.exercises[0]").value("케이블 풀오버"))
                .andExpect(jsonPath("$.session.exercises[1].bodyweight").value(true))
                .andExpect(jsonPath("$.prs[0].label").value("케이블 풀오버"));
        mvc.perform(get("/api/workouts/previous?exercise=" + lsit).with(as(alice)))
                .andExpect(jsonPath("$.sets[0].reps").value(20));
        postJson("/api/workouts", bob, """
                {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:40:00Z",
                 "exercises":[{"exercise":"%s","sets":[{"weightKg":35,"reps":10}]}]}""".formatted(lsit))
                .andExpect(status().isBadRequest());

        // 최근: 세션(10시)에 한 두 종목이 빠른 기록(오늘 0시 기준)보다 앞
        mvc.perform(get("/api/lifts/recent").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[2].code").value("SQUAT"));

        // 지우기: 목록 · 최근 · 새 기록에서 빠지고, 지난 기록 이름은 남는다
        mvc.perform(delete("/api/lifts/custom/" + pullover).with(as(bob))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/lifts/custom/" + pullover).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/lifts/custom").with(as(alice))).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/lifts/recent").with(as(alice))).andExpect(jsonPath("$.length()").value(2));
        postJson("/api/lifts", alice, "{\"exercise\":\"" + pullover + "\",\"weightKg\":30,\"reps\":12}").andExpect(status().isBadRequest());
        mvc.perform(get("/api/lifts").with(as(alice))).andExpect(jsonPath("$.entries[1].label").value("케이블 풀오버"));
        mvc.perform(get("/api/workouts").with(as(alice))).andExpect(jsonPath("$[0].exercises[0]").value("케이블 풀오버"));
        // 지웠으니 같은 이름으로 다시 추가할 수 있다
        addCustom(alice, "케이블 풀오버", "BACK", false);
    }
}
