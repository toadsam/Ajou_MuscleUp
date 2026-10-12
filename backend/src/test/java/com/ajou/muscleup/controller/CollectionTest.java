package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.RunSession;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.RunSessionRepository;
import com.ajou.muscleup.repository.UserCollectionRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.CollectionItem;
import com.ajou.muscleup.service.CollectionService;
import com.ajou.muscleup.service.RewardRandom;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Deque;
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
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 도감 · 보상 상자. 지금을 2026-10-15 12:00 KST 로, 뽑기 난수는 정해 둔 순서로 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CollectionTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 15);

    /** 넣어 둔 값을 차례로 돌려준다(비면 99) */
    static class ScriptedRandom extends RewardRandom {
        final Deque<Integer> next = new ArrayDeque<>();

        @Override
        public int nextInt(int bound) {
            Integer v = next.poll();
            return Math.min(bound - 1, v == null ? 99 : v);
        }
    }

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(TODAY.atTime(12, 0).atZone(TimeConfig.KST).toInstant(), TimeConfig.KST);
        }

        @Bean
        @Primary
        ScriptedRandom scriptedRandom() {
            return new ScriptedRandom();
        }
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired UserCollectionRepository wallets;
    @Autowired RunSessionRepository runs;
    @Autowired CollectionService collectionService;
    @Autowired ScriptedRandom random;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        random.next.clear();
        alice = save("col-alice@test.local");
        bob = save("col-bob@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 9)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions open(User u) throws Exception {
        return mvc.perform(post("/api/collection/boxes/open").with(as(u)));
    }

    private ResultActions json(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder b, User u, String body) throws Exception {
        return mvc.perform(b.with(as(u)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void welcomeBoxOpenDuplicateCraftEquip() throws Exception {
        int total = CollectionItem.values().length;
        // 처음 오기 전에도 요약은 환영 상자 하나를 센다
        mvc.perform(get("/api/collection/summary").with(as(alice)))
                .andExpect(jsonPath("$.boxes").value(1))
                .andExpect(jsonPath("$.activity.level").value(1));
        mvc.perform(get("/api/collection").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.welcomeBox").value(true))
                .andExpect(jsonPath("$.boxes").value(1))
                .andExpect(jsonPath("$.owned").value(0))
                .andExpect(jsonPath("$.total").value(total))
                .andExpect(jsonPath("$.items[0].code").value("T_FIRST_STEP"))
                .andExpect(jsonPath("$.items[0].progress").value(0))
                .andExpect(jsonPath("$.items[0].goal").value(1));
        // 두 번째로 와도 환영 상자는 한 번
        mvc.perform(get("/api/collection").with(as(alice))).andExpect(jsonPath("$.welcomeBox").value(false))
                .andExpect(jsonPath("$.boxes").value(1));

        // 등급 0 → 보통, 보통 상자 아이템 중 첫 번째(새벽 헬스러)
        random.next.addAll(List.of(0, 0));
        open(alice).andExpect(status().isOk())
                .andExpect(jsonPath("$.item.code").value("T_DAWN"))
                .andExpect(jsonPath("$.item.owned").value(true))
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.boxes").value(0));
        open(alice).andExpect(status().isBadRequest());

        // 주간 목표 상자 → 같은 게 나오면 조각 5
        collectionService.onWorkoutDay(alice, TODAY, true);
        random.next.addAll(List.of(10, 0));
        open(alice).andExpect(jsonPath("$.duplicate").value(true))
                .andExpect(jsonPath("$.shardsGained").value(5))
                .andExpect(jsonPath("$.shards").value(5));
        // 전설(98 이상)
        collectionService.onWorkoutDay(alice, TODAY, true);
        random.next.addAll(List.of(99, 0));
        open(alice).andExpect(jsonPath("$.item.rarity").value("LEGENDARY"));

        // 조각으로 만들기: 모자라면 거절, 업적 아이템 · 가진 것도 거절
        json(post("/api/collection/craft"), alice, "{\"code\":\"T_PROTEIN\"}").andExpect(status().isBadRequest());
        wallets.findByUser_Id(alice.getId()).orElseThrow().setShards(35);
        json(post("/api/collection/craft"), alice, "{\"code\":\"T_PROTEIN\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.owned").value(true));
        assertThat(wallets.findByUser_Id(alice.getId()).orElseThrow().getShards()).isEqualTo(5);
        json(post("/api/collection/craft"), alice, "{\"code\":\"T_PROTEIN\"}").andExpect(status().isBadRequest());
        json(post("/api/collection/craft"), alice, "{\"code\":\"T_MARATHON\"}").andExpect(status().isBadRequest());

        // 장착: 가진 것만, 칸에 맞는 것만, 비우기
        json(put("/api/collection/equip"), alice, "{\"category\":\"TITLE\",\"code\":\"T_DAWN\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("새벽 헬스러"));
        json(put("/api/collection/equip"), alice, "{\"category\":\"TANK\",\"code\":\"K_GOLD\"}").andExpect(status().isBadRequest());
        json(put("/api/collection/equip"), alice, "{\"category\":\"TANK\",\"code\":\"T_DAWN\"}").andExpect(status().isBadRequest());
        mvc.perform(get("/api/collection/summary").with(as(alice)))
                .andExpect(jsonPath("$.boxes").value(0))
                .andExpect(jsonPath("$.owned").value(3))
                .andExpect(jsonPath("$.equipped.titleCode").value("T_DAWN"));
        json(put("/api/collection/equip"), alice, "{\"category\":\"TITLE\",\"code\":null}")
                .andExpect(jsonPath("$.title").doesNotExist());

        // 남의 지갑은 따로
        mvc.perform(get("/api/collection/summary").with(as(bob))).andExpect(jsonPath("$.boxes").value(1)).andExpect(jsonPath("$.owned").value(0));
        mvc.perform(get("/api/collection")).andExpect(status().is4xxClientError());
    }

    @Test
    void attendanceGivesLuckyBoxOnceADayAndAchievements() throws Exception {
        String workout = "{\"didWorkout\":true,\"workoutTypes\":[\"weight\"]}";
        random.next.add(5); // 20 미만 → 행운 상자
        json(post("/api/attendance/today"), alice, workout)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rewardBox").value("LUCKY"))
                .andExpect(jsonPath("$.unlockedItems", hasItem("첫 발걸음")));
        // 같은 날 운동 취소 → 다시 운동: 행운은 하루 한 번만 굴린다
        random.next.add(0);
        json(put("/api/attendance/" + TODAY), alice, "{\"didWorkout\":false}").andExpect(status().isOk());
        json(put("/api/attendance/" + TODAY), alice, workout).andExpect(jsonPath("$.rewardBox").doesNotExist());
        assertThat(random.next).containsExactly(0);
        random.next.clear();

        // 러닝 누적 42.195km → 업적 두 개(첫 러닝 · 마라토너)가 도감을 열 때 생기고 "새로 얻음"
        runs.save(RunSession.builder().user(alice).performedOn(TODAY).startedAt(TODAY.atTime(6, 0)).endedAt(TODAY.atTime(10, 0))
                .durationSec(14000).distanceM(42200).source("GPS").build());
        mvc.perform(get("/api/collection").with(as(alice)))
                .andExpect(jsonPath("$.newlyUnlocked", hasItems("첫 러닝", "마라토너")))
                .andExpect(jsonPath("$.boxes").value(2)) // 행운 상자 + 환영 상자
                .andExpect(jsonPath("$.items[?(@.code=='T_MARATHON')].isNew").value(true))
                .andExpect(jsonPath("$.items[?(@.code=='T_REGULAR')].progress").value(1));
        mvc.perform(get("/api/collection").with(as(alice)))
                .andExpect(jsonPath("$.newlyUnlocked.length()").value(0))
                .andExpect(jsonPath("$.items[?(@.code=='T_MARATHON')].isNew").value(false));

        // 행운이 안 걸리면 상자 없음(다른 사람, 99)
        json(post("/api/attendance/today"), bob, workout).andExpect(jsonPath("$.rewardBox").doesNotExist());
    }
}
