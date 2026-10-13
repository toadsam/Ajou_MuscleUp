package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 식단 "내 음식": 저장(같은 이름이면 새 값) · 고치기 · 지우기 · 본인만 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MyFoodTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("mf-alice@test.local");
        bob = save("mf-bob@test.local");
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

    private ResultActions putJson(String url, User u, String body) throws Exception {
        return mvc.perform(put(url).with(as(u)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void saveUpsertEditDeleteAndOwnerOnly() throws Exception {
        String body = postJson("/api/diet/my-foods", alice,
                "{\"name\":\"  엄마   김치찌개 \",\"amount\":\"1그릇\",\"kcal\":450,\"proteinG\":22.34,\"carbG\":18,\"fatG\":25}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("엄마 김치찌개"))
                .andExpect(jsonPath("$.proteinG").value(22.3))
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(body, "$.id");
        postJson("/api/diet/my-foods", alice, "{\"name\":\"학식 제육\",\"amount\":\"1인분\",\"kcal\":700}").andExpect(status().isOk());

        // 같은 이름(띄어쓰기 무시)으로 다시 저장하면 새로 만들지 않고 값만 바꾼다
        postJson("/api/diet/my-foods", alice, "{\"name\":\"엄마김치찌개\",\"amount\":\"반 그릇\",\"kcal\":230}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
        mvc.perform(get("/api/diet/my-foods").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("엄마김치찌개"))
                .andExpect(jsonPath("$[0].kcal").value(230))
                .andExpect(jsonPath("$[1].name").value("학식 제육"));

        // 잘못된 값 · 빈 이름은 거절
        postJson("/api/diet/my-foods", alice, "{\"name\":\"너무 많은 칼로리\",\"kcal\":9000}").andExpect(status().isBadRequest());
        postJson("/api/diet/my-foods", alice, "{\"name\":\" \"}").andExpect(status().isBadRequest());

        // 고치기: 다른 내 음식과 같은 이름은 409
        putJson("/api/diet/my-foods/" + id, alice, "{\"name\":\"엄마 김치찌개\",\"amount\":\"1그릇\",\"kcal\":460}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kcal").value(460));
        putJson("/api/diet/my-foods/" + id, alice, "{\"name\":\"학식제육\"}").andExpect(status().isConflict());

        // 남의 것은 보이지도, 고치지도, 지우지도 못한다
        mvc.perform(get("/api/diet/my-foods").with(as(bob))).andExpect(jsonPath("$.length()").value(0));
        putJson("/api/diet/my-foods/" + id, bob, "{\"name\":\"내 거\"}").andExpect(status().isNotFound());
        mvc.perform(delete("/api/diet/my-foods/" + id).with(as(bob))).andExpect(status().isNotFound());

        mvc.perform(delete("/api/diet/my-foods/" + id).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/diet/my-foods").with(as(alice))).andExpect(jsonPath("$.length()").value(1));
    }
}
