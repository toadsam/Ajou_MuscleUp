package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.Friendship;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBlock;
import com.ajou.muscleup.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 친구 헬스장 구경 · 방명록: 친구만 · 한 줄 60자 · 하루 3개 · 지우기 권한 · 차단 · 이메일 없음 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GymVisitTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired EntityManager em;

    private User alice;
    private User bob;
    private User carol;

    @BeforeEach
    void setUp() {
        alice = save("gv-alice@test.local");
        bob = save("gv-bob@test.local");
        carol = save("gv-carol@test.local");
        User low = alice.getId() < bob.getId() ? alice : bob;
        User high = low == alice ? bob : alice;
        em.persist(Friendship.builder().userLow(low).userHigh(high).build());
        em.flush();
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(3, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions write(User me, User owner, String message) throws Exception {
        return mvc.perform(post("/api/gym-decor/friends/" + owner.getId() + "/guestbook").with(as(me))
                .contentType(MediaType.APPLICATION_JSON).content("{\"message\":" + (message == null ? "null" : "\"" + message + "\"") + "}"));
    }

    @Test
    void friendsVisitAndSignGuestbook() throws Exception {
        // 친구가 아니면(나 자신 포함) 구경 못 함
        mvc.perform(get("/api/gym-decor/friends/" + alice.getId()).with(as(carol))).andExpect(status().isNotFound());
        mvc.perform(get("/api/gym-decor/friends/" + alice.getId()).with(as(alice))).andExpect(status().isNotFound());
        write(carol, alice, "안녕").andExpect(status().isNotFound());

        // 친구는 헬스장 모습(기본 화분 · 빨간 원)과 닉네임을 본다
        mvc.perform(get("/api/gym-decor/friends/" + alice.getId()).with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("alice"))
                .andExpect(jsonPath("$.slots[?(@.slot=='CENTER')].code").value(hasItem("RING_RED")))
                .andExpect(jsonPath("$.guestbook.length()").value(0));

        // 한 줄: 공백 정리 · 빈 글 · 60자 넘으면 거절
        String body = write(bob, alice, "  놀러   왔어요 ").andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("놀러 왔어요"))
                .andExpect(jsonPath("$.mine").value(true))
                .andReturn().getResponse().getContentAsString();
        Integer first = JsonPath.read(body, "$.id");
        write(bob, alice, "   ").andExpect(status().isBadRequest());
        write(bob, alice, "가".repeat(61)).andExpect(status().isBadRequest());

        // 24시간에 같은 헬스장 3개까지
        write(bob, alice, "두 번째").andExpect(status().isOk());
        write(bob, alice, "세 번째").andExpect(status().isOk());
        write(bob, alice, "네 번째").andExpect(status().isTooManyRequests());

        // 주인은 내 방명록에서 모두 보고 지울 수 있다. 이메일은 싣지 않는다
        String mine = mvc.perform(get("/api/gym-decor/guestbook").with(as(alice)))
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].message").value("세 번째"))
                .andExpect(jsonPath("$[0].nickname").value("bob@t"))
                .andExpect(jsonPath("$[0].canDelete").value(true))
                .andExpect(jsonPath("$[0].mine").value(false))
                .andReturn().getResponse().getContentAsString();
        assertThat(mine).doesNotContain("@test.local");

        // 지우기: 남은 못 지우고, 쓴 사람 · 주인은 지운다
        mvc.perform(delete("/api/gym-decor/guestbook/" + first).with(as(carol))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/gym-decor/guestbook/" + first).with(as(bob))).andExpect(status().isNoContent());
        Integer second = JsonPath.read(mine, "$[1].id");
        mvc.perform(delete("/api/gym-decor/guestbook/" + second).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/gym-decor/guestbook").with(as(alice))).andExpect(jsonPath("$.length()").value(1));

        // 차단하면 구경 · 쓰기 막히고, 그 사람 글은 내 방명록에서 안 보인다
        em.persist(UserBlock.builder().blocker(alice).blocked(bob).build());
        em.flush();
        mvc.perform(get("/api/gym-decor/friends/" + alice.getId()).with(as(bob))).andExpect(status().isNotFound());
        write(bob, alice, "또 왔어요").andExpect(status().isNotFound());
        mvc.perform(get("/api/gym-decor/guestbook").with(as(alice))).andExpect(jsonPath("$.length()").value(0));
    }
}
