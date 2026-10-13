package com.ajou.muscleup.controller;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserCollection;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.AvatarLookService;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 다른 사람에게도 보이는 겉모습: 장착 민소매 · 칭호, 운동 직후 1시간 펌핑. 지금을 2026-10-15 12:00 KST 로 고정 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AvatarLookTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 15);
    static final long NOW_MS = TODAY.atTime(12, 0).atZone(TimeConfig.KST).toInstant().toEpochMilli();

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
    @Autowired AvatarLookService looks;
    @Autowired EntityManager em;

    private User alice;
    private User bob;
    private User carol;

    @BeforeEach
    void setUp() {
        alice = save("lk-alice@test.local");
        bob = save("lk-bob@test.local");
        carol = save("lk-carol@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private void workout(User u, String startUtc, String endUtc) throws Exception {
        mvc.perform(post("/api/workouts").with(as(u)).contentType(MediaType.APPLICATION_JSON).content("""
                        {"startedAt":"%s","endedAt":"%s","checkAttendance":false,
                         "exercises":[{"exercise":"SQUAT","sets":[{"weightKg":60,"reps":5}]}]}""".formatted(startUtc, endUtc)))
                .andExpect(status().isCreated());
    }

    @Test
    void pumpForAnHourAfterWorkoutAndEquippedTankTitle() throws Exception {
        // alice: 30분 전에 끝냄(11:30 KST = 02:30Z) → 12:30 까지 펌핑. bob: 2시간 전에 끝냄 → 펌핑 끝
        workout(alice, "2026-10-15T02:00:00Z", "2026-10-15T02:30:00Z");
        workout(bob, "2026-10-15T01:00:00Z", "2026-10-15T01:59:00Z");
        // alice 는 검정 민소매 · "첫 발걸음" 칭호를 장착
        em.persist(UserCollection.builder().user(alice).equippedTank("K_BLACK").equippedTitle("T_FIRST_STEP").build());
        em.flush();

        long until = TODAY.atTime(12, 30).atZone(TimeConfig.KST).toInstant().toEpochMilli();
        Map<Long, AvatarLookService.Look> map = looks.looks(List.of(alice.getId(), bob.getId(), carol.getId()));
        assertThat(map.get(alice.getId()).pumpedUntil()).isEqualTo(until);
        assertThat(map.get(alice.getId()).pumped(NOW_MS)).isTrue();
        assertThat(map.get(alice.getId()).tank()).isEqualTo("#1C1D21");
        assertThat(map.get(alice.getId()).title()).isEqualTo("첫 발걸음");
        assertThat(map).doesNotContainKey(bob.getId()); // 펌핑 끝 · 장착 없음
        assertThat(map).doesNotContainKey(carol.getId());

        // 내 캐릭터 응답에도 실린다
        mvc.perform(get("/api/character/me").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pumpedUntil").value(until))
                .andExpect(jsonPath("$.tank").value("#1C1D21"));
        mvc.perform(get("/api/character/me").with(as(bob)))
                .andExpect(jsonPath("$.pumpedUntil").doesNotExist())
                .andExpect(jsonPath("$.tank").doesNotExist());
    }
}
