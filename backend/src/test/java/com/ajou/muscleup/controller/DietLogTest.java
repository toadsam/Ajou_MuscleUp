package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 식단 기록(PR A): 본인만 · 합계 · 목표/제안 · 날짜 검사 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DietLogTest {

    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired UserRepository users;
    @Autowired UserBodyStatsRepository bodyStats;
    @Autowired Clock clock;

    private User alice;
    private User bob;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        alice = save("dl-alice@test.local");
        bob = save("dl-bob@test.local");
        today = LocalDate.now(clock);
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private Integer add(User u, String json) throws Exception {
        String body = mvc.perform(post("/api/diet/entries").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    @Test
    void addListTotalsAndOnlyMine() throws Exception {
        Integer chicken = add(alice, "{\"mealType\":\"LUNCH\",\"name\":\"닭가슴살\",\"amount\":\"150g\",\"kcal\":165,\"proteinG\":31,\"carbG\":0,\"fatG\":3.6}");
        add(alice, "{\"mealType\":\"BREAKFAST\",\"name\":\" 현미밥 \",\"kcal\":300,\"proteinG\":6.5,\"carbG\":64}");
        add(alice, "{\"date\":\"" + today.minusDays(1) + "\",\"mealType\":\"DINNER\",\"name\":\"어제 저녁\",\"kcal\":700}");

        // 오늘: 아침이 먼저, 합계는 비어 있는 값을 0 으로
        mvc.perform(get("/api/diet/day").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(today.toString()))
                .andExpect(jsonPath("$.entries", hasSize(2)))
                .andExpect(jsonPath("$.entries[0].name").value("현미밥"))
                .andExpect(jsonPath("$.entries[1].amount").value("150g"))
                .andExpect(jsonPath("$.totals.kcal").value(465))
                .andExpect(jsonPath("$.totals.proteinG").value(37.5))
                .andExpect(jsonPath("$.totals.fatG").value(3.6));

        // 최근 7일 합계
        mvc.perform(get("/api/diet/summary").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(7)))
                .andExpect(jsonPath("$[5].totals.kcal").value(700))
                .andExpect(jsonPath("$[6].totals.count").value(2));
        mvc.perform(get("/api/diet/summary").with(as(alice)).param("from", today.minusDays(40).toString()))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/diet/recent-foods").with(as(alice)))
                .andExpect(jsonPath("$", hasSize(3)));

        // 밥은 앨리스 기록을 못 보고 못 고친다
        mvc.perform(get("/api/diet/day").with(as(bob))).andExpect(jsonPath("$.entries", hasSize(0)));
        mvc.perform(put("/api/diet/entries/" + chicken).with(as(bob)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"바꿈\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/diet/entries/" + chicken).with(as(bob))).andExpect(status().isNotFound());

        // 앨리스는 고치고 지운다
        mvc.perform(put("/api/diet/entries/" + chicken).with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"닭가슴살\",\"amount\":\"200g\",\"kcal\":220,\"proteinG\":41}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mealType").value("LUNCH"))
                .andExpect(jsonPath("$.kcal").value(220));
        mvc.perform(delete("/api/diet/entries/" + chicken).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/diet/day").with(as(alice))).andExpect(jsonPath("$.entries", hasSize(1)));
    }

    @Test
    void rejectsBadInput() throws Exception {
        String[] bad = {
                "{\"mealType\":\"LUNCH\",\"name\":\"  \"}",
                "{\"name\":\"끼니 없음\"}",
                "{\"date\":\"" + today.plusDays(1) + "\",\"mealType\":\"LUNCH\",\"name\":\"내일\"}",
                "{\"mealType\":\"LUNCH\",\"name\":\"음수\",\"proteinG\":-1}",
                "{\"mealType\":\"LUNCH\",\"name\":\"너무 큼\",\"kcal\":99999}",
        };
        for (String json : bad) {
            mvc.perform(post("/api/diet/entries").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content(json))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/diet/day")).andExpect(status().isUnauthorized());
    }

    @Test
    void goalSuggestedFromWeightThenSaved() throws Exception {
        // 목표도 체중도 없으면 빈 응답
        mvc.perform(get("/api/diet/goal").with(as(alice))).andExpect(status().isNoContent());

        bodyStats.save(UserBodyStats.builder().user(alice).gender(Gender.FEMALE).weightKg(60.0).build());
        em.flush();
        mvc.perform(get("/api/diet/goal").with(as(alice)))
                .andExpect(jsonPath("$.saved").value(false))
                .andExpect(jsonPath("$.proteinG").value(96))
                .andExpect(jsonPath("$.source").value("BODY_STATS"));

        mvc.perform(put("/api/diet/goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/diet/goal").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kcal\":2100,\"proteinG\":120,\"carbG\":230,\"fatG\":60,\"source\":\"INBODY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(true))
                .andExpect(jsonPath("$.source").value("INBODY"));
        mvc.perform(get("/api/diet/day").with(as(alice)))
                .andExpect(jsonPath("$.goal.kcal").value(2100))
                .andExpect(jsonPath("$.goal.proteinG").value(120));

        mvc.perform(delete("/api/diet/goal").with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/diet/goal").with(as(alice))).andExpect(jsonPath("$.saved").value(false));
    }
}
