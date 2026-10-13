package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
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

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 지금 운동 · 러닝 중: 알리기 · 목록(닉네임 · 종목 · 겉모습만) · 남의 종목 코드 · 끝내기 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class LiveActivityTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("lv-alice@test.local", "앨리스리프터");
        bob = save("lv-bob@test.local", "밥러너");
    }

    private User save(String email, String nickname) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(nickname).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions beat(User u, String body) throws Exception {
        return mvc.perform(put("/api/live").with(as(u)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void beatListAndEnd() throws Exception {
        // 캐릭터가 있어야 목록에 나온다
        mvc.perform(get("/api/character/me").with(as(alice))).andExpect(status().isOk());
        mvc.perform(get("/api/character/me").with(as(bob))).andExpect(status().isOk());

        beat(alice, "{\"activity\":\"WORKOUT\",\"exercise\":\"SQUAT\"}").andExpect(status().isNoContent());
        beat(bob, "{\"activity\":\"run\"}").andExpect(status().isNoContent());
        beat(bob, "{\"activity\":\"NAP\"}").andExpect(status().isBadRequest());

        mvc.perform(get("/api/live").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.nickname=='앨리스리프터')].label").value(hasItem("스쿼트")))
                .andExpect(jsonPath("$.items[?(@.nickname=='앨리스리프터')].mine").value(hasItem(false)))
                .andExpect(jsonPath("$.items[?(@.nickname=='밥러너')].activity").value(hasItem("RUN")))
                .andExpect(jsonPath("$.items[?(@.nickname=='밥러너')].mine").value(hasItem(true)))
                // 이메일 · 사용자 번호는 싣지 않는다
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("lv-alice@test.local"))))
                .andExpect(jsonPath("$.items[0].userId").doesNotExist());

        // 남의 직접 추가 종목 코드는 종목 없이 "운동 중"으로만
        String body = mvc.perform(post("/api/lifts/custom").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"앨리스 비밀 종목\",\"category\":\"BACK\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String code = com.jayway.jsonpath.JsonPath.read(body, "$.code");
        beat(bob, "{\"activity\":\"WORKOUT\",\"exercise\":\"" + code + "\"}").andExpect(status().isNoContent());
        mvc.perform(get("/api/live").with(as(alice)))
                .andExpect(jsonPath("$.items[?(@.nickname=='밥러너')].activity").value(hasItem("WORKOUT")))
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("앨리스 비밀 종목"))));

        // 끝내면 빠진다
        mvc.perform(delete("/api/live").with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/live").with(as(bob)))
                .andExpect(jsonPath("$.items[?(@.nickname=='앨리스리프터')]").isEmpty());
        mvc.perform(delete("/api/live").with(as(bob))).andExpect(status().isNoContent());
    }
}
