package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WeeklyGoalWeek;
import com.ajou.muscleup.repository.UserRepository;
import jakarta.persistence.EntityManager;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 주간 목표 연속 기록(PR D). 오늘을 2026-10-15(목)로 고정 — 이번 주는 10-12(월)~10-18(일) */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class WeeklyGoalTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 15);
    static final LocalDate WEEK = LocalDate.of(2026, 10, 12);

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(TODAY.atTime(12, 0).atZone(TimeConfig.KST).toInstant(), TimeConfig.KST);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired UserRepository users;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = save("wg-alice@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private void workout(User u, LocalDate... dates) {
        for (LocalDate d : dates) {
            em.persist(AttendanceLog.builder().user(u).date(d).didWorkout(true).build());
        }
        em.flush();
    }

    private static final String WORKOUT = "{\"didWorkout\":true,\"workoutTypes\":[\"weight\"],\"workoutIntensity\":\"normal\"}";

    @Test
    void streakCountsAchievedWeeksAndBonusOncePerWeek() throws Exception {
        // 9/21 주 2번(실패) → 9/28 · 10/5 주 3번씩(달성) → 이번 주 월 · 화
        workout(alice, LocalDate.of(2026, 9, 22), LocalDate.of(2026, 9, 24));
        workout(alice, LocalDate.of(2026, 9, 28), LocalDate.of(2026, 9, 30), LocalDate.of(2026, 10, 2));
        workout(alice, LocalDate.of(2026, 10, 6), LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 11));
        workout(alice, WEEK, WEEK.plusDays(1));

        mvc.perform(get("/api/attendance/weekly-goal").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekStart").value("2026-10-12"))
                .andExpect(jsonPath("$.target").value(3))
                .andExpect(jsonPath("$.done").value(2))
                .andExpect(jsonPath("$.days[0]").value(true))
                .andExpect(jsonPath("$.days[1]").value(true))
                .andExpect(jsonPath("$.days[3]").value(false))
                .andExpect(jsonPath("$.achieved").value(false))
                .andExpect(jsonPath("$.streakWeeks").value(2)) // 진행 중인 이번 주는 끊지 않는다
                .andExpect(jsonPath("$.bonusPoints").value(14)); // 달성하면 3주 연속 → 8 + 2×3

        // 오늘 출석으로 3번째 → 보너스가 출석 점수에 더해진다
        mvc.perform(post("/api/attendance/today").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content(WORKOUT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeklyGoalBonus").value(14))
                .andExpect(jsonPath("$.weeklyGoalStreak").value(3))
                .andExpect(jsonPath("$.expEarned").value(greaterThanOrEqualTo(14 + 5)));

        mvc.perform(get("/api/attendance/weekly-goal").with(as(alice)))
                .andExpect(jsonPath("$.achieved").value(true))
                .andExpect(jsonPath("$.rewarded").value(true))
                .andExpect(jsonPath("$.streakWeeks").value(3))
                .andExpect(jsonPath("$.canRest").value(false));

        // 휴식으로 바꿨다가 다시 운동으로 → 보너스는 한 주에 한 번
        mvc.perform(put("/api/attendance/" + TODAY).with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"didWorkout\":false}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/attendance/" + TODAY).with(as(alice)).contentType(MediaType.APPLICATION_JSON).content(WORKOUT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeklyGoalBonus").value(nullValue()));
    }

    @Test
    void targetChangeAppliesNowOnlyBeforeFirstWorkout() throws Exception {
        mvc.perform(put("/api/attendance/weekly-goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"target\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.target").value(2))
                .andExpect(jsonPath("$.nextTarget").value(2));

        mvc.perform(post("/api/attendance/today").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content(WORKOUT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeklyGoalBonus").value(nullValue()));

        // 이번 주에 운동한 뒤에는 다음 주부터(낮춰서 연속을 지키는 것 막기)
        mvc.perform(put("/api/attendance/weekly-goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"target\":5}"))
                .andExpect(jsonPath("$.target").value(2))
                .andExpect(jsonPath("$.nextTarget").value(5))
                .andExpect(jsonPath("$.done").value(1));

        mvc.perform(put("/api/attendance/weekly-goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"target\":0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/attendance/weekly-goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"target\":8}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void restWeekKeepsStreakAndIsLimited() throws Exception {
        // 9/28 주 달성 → 10/5 주는 쉬는 주(0번) → 이번 주 진행 중
        workout(alice, LocalDate.of(2026, 9, 28), LocalDate.of(2026, 9, 29), LocalDate.of(2026, 9, 30));
        em.persist(WeeklyGoalWeek.builder().user(alice).weekStart(LocalDate.of(2026, 10, 5)).target(3).rest(true).build());
        em.flush();

        mvc.perform(get("/api/attendance/weekly-goal").with(as(alice)))
                .andExpect(jsonPath("$.streakWeeks").value(1))
                .andExpect(jsonPath("$.canRest").value(false)); // 최근 4주 안에 이미 씀
        mvc.perform(put("/api/attendance/weekly-goal/rest").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"rest\":true}"))
                .andExpect(status().isBadRequest());

        // 다른 사람은 이번 주를 쉬는 주로 정했다 풀 수 있다
        User bob = save("wg-bob@test.local");
        mvc.perform(put("/api/attendance/weekly-goal/rest").with(as(bob)).contentType(MediaType.APPLICATION_JSON).content("{\"rest\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rest").value(true))
                .andExpect(jsonPath("$.canRest").value(false));
        mvc.perform(put("/api/attendance/weekly-goal/rest").with(as(bob)).contentType(MediaType.APPLICATION_JSON).content("{\"rest\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rest").value(false));
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/attendance/weekly-goal")).andExpect(status().is4xxClientError());
    }
}
