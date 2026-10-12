package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.ActivityLevel;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 오늘 할 일 · 활동 레벨(PR E). 오늘을 2026-10-15 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DailyQuestTest {

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
    @Autowired EntityManager em;
    @Autowired UserRepository users;
    @Autowired BragPostRepository posts;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("dq-alice@test.local");
        bob = save("dq-bob@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private BragPost brag(User author) {
        return posts.save(BragPost.builder().user(author).title("자랑").content("본문").mediaUrls(new ArrayList<>(List.of("/m.png")))
                .visibility(BragVisibility.PUBLIC).build());
    }

    private int total(User u) throws Exception {
        String body = mvc.perform(get("/api/quests/today").with(as(u))).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.activity.totalPoints");
    }

    @Test
    void questsGivePointsOnceAndAllThreeBonus() throws Exception {
        mvc.perform(get("/api/quests/today").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value("2026-10-15"))
                .andExpect(jsonPath("$.items[0].id").value("attendance"))
                .andExpect(jsonPath("$.items[0].done").value(false))
                .andExpect(jsonPath("$.items[1].done").value(false))
                .andExpect(jsonPath("$.items[2].done").value(false))
                .andExpect(jsonPath("$.protein.goalG").doesNotExist())
                .andExpect(jsonPath("$.activity.level").value(1))
                .andExpect(jsonPath("$.activity.totalPoints").value(0));

        // 식단 1끼(단백질 목표 30g 넘김) → +3, +5
        mvc.perform(put("/api/diet/goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"proteinG\":30}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/diet/entries").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mealType\":\"LUNCH\",\"name\":\"닭가슴살\",\"kcal\":165,\"proteinG\":31}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/quests/today").with(as(alice)))
                .andExpect(jsonPath("$.items[1].done").value(true))
                .andExpect(jsonPath("$.protein.goalG").value(30))
                .andExpect(jsonPath("$.protein.done").value(true))
                .andExpect(jsonPath("$.protein.rewarded").value(true))
                .andExpect(jsonPath("$.activity.totalPoints").value(8));

        // 내 글 좋아요는 응원이 아니다 → 다른 사람 글 좋아요 +2
        BragPost mine = brag(alice);
        BragPost bobs = brag(bob);
        mvc.perform(post("/api/brags/" + mine.getId() + "/like").with(as(alice))).andExpect(status().isOk());
        mvc.perform(get("/api/quests/today").with(as(alice))).andExpect(jsonPath("$.items[2].done").value(false));
        mvc.perform(post("/api/brags/" + bobs.getId() + "/like").with(as(alice))).andExpect(status().isOk());
        mvc.perform(get("/api/quests/today").with(as(alice)))
                .andExpect(jsonPath("$.items[2].done").value(true))
                .andExpect(jsonPath("$.activity.totalPoints").value(10));

        // 좋아요를 껐다 켜도 한 번뿐
        mvc.perform(post("/api/brags/" + bobs.getId() + "/like").with(as(alice)));
        mvc.perform(post("/api/brags/" + bobs.getId() + "/like").with(as(alice)));
        assertThat(total(alice)).isEqualTo(10);

        // 출석까지 → 세 개 다 +5 (출석 점수 따로)
        String body = mvc.perform(post("/api/attendance/today").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"didWorkout\":true,\"workoutTypes\":[\"weight\"]}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int attendancePoints = JsonPath.read(body, "$.expEarned");
        mvc.perform(get("/api/quests/today").with(as(alice)))
                .andExpect(jsonPath("$.items[0].done").value(true))
                .andExpect(jsonPath("$.allDone").value(true))
                .andExpect(jsonPath("$.allRewarded").value(true))
                .andExpect(jsonPath("$.activity.totalPoints").value(10 + attendancePoints + 5));

        // 같은 날 식단을 더 적어도 그대로
        mvc.perform(post("/api/diet/entries").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"mealType\":\"DINNER\",\"name\":\"현미밥\",\"kcal\":300}"));
        assertThat(total(alice)).isEqualTo(10 + attendancePoints + 5);
    }

    @Test
    void pastMealsAndAnonymousCheersDoNotCount() throws Exception {
        mvc.perform(post("/api/diet/entries").with(as(bob)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"2026-10-14\",\"mealType\":\"LUNCH\",\"name\":\"어제 점심\",\"kcal\":500}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/quests/today").with(as(bob)))
                .andExpect(jsonPath("$.items[1].done").value(false))
                .andExpect(jsonPath("$.activity.totalPoints").value(0));

        // 다른 사람 출석 공유글 응원: 로그인했으면 할 일, 아니면 숫자만
        em.persist(AttendanceLog.builder().user(alice).date(TODAY).didWorkout(true).shared(true).shareSlug("dq-share-1").build());
        em.flush();
        mvc.perform(post("/api/attendance/share/dq-share-1/cheer")).andExpect(status().isOk());
        mvc.perform(post("/api/attendance/share/dq-share-1/cheer").with(as(bob))).andExpect(status().isOk());
        mvc.perform(get("/api/quests/today").with(as(bob)))
                .andExpect(jsonPath("$.items[2].done").value(true))
                .andExpect(jsonPath("$.activity.totalPoints").value(2));
        // 내 출석 응원은 아니다
        mvc.perform(post("/api/attendance/share/dq-share-1/cheer").with(as(alice))).andExpect(status().isOk());
        mvc.perform(get("/api/quests/today").with(as(alice))).andExpect(jsonPath("$.items[2].done").value(false));
    }

    @Test
    void activityLevelCurve() {
        assertThat(ActivityLevel.of(0)).isEqualTo(new ActivityLevel(1, 0, 0, 40));
        assertThat(ActivityLevel.of(39).level()).isEqualTo(1);
        assertThat(ActivityLevel.of(40)).isEqualTo(new ActivityLevel(2, 40, 0, 50));
        assertThat(ActivityLevel.of(89)).isEqualTo(new ActivityLevel(2, 89, 49, 50));
        assertThat(ActivityLevel.of(720).level()).isEqualTo(10);
        assertThat(ActivityLevel.of(-5).level()).isEqualTo(1);
    }

    @Test
    void requiresLogin() throws Exception {
        mvc.perform(get("/api/quests/today")).andExpect(status().is4xxClientError());
    }
}
