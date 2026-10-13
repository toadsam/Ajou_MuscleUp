package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.LiftEntry;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.UserRepository;
import jakarta.persistence.EntityManager;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 홈 헬스장 꾸미기: 기본 물품 · 기록으로 얻기 · 자리에 놓기/옮기기/비우기 · 본인만 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GymDecorTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired EntityManager em;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = save("gd-alice@test.local");
        bob = save("gd-bob@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private ResultActions place(User u, String slot, String code) throws Exception {
        String body = code == null ? "{\"code\":null}" : "{\"code\":\"" + code + "\"}";
        return mvc.perform(put("/api/gym-decor/slots/" + slot).with(as(u)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String slot(String name) {
        return "$.slots[?(@.slot=='" + name + "')].code";
    }

    private static String item(String code, String field) {
        return "$.items[?(@.code=='" + code + "')]." + field;
    }

    @Test
    void defaultsUnlockFromRecordsAndPlace() throws Exception {
        // 처음: 화분 · 빨간 원만 놓여 있고, 나머지는 잠김(진행도 · 조건 보임)
        mvc.perform(get("/api/gym-decor").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(slot("CORNER_TOP")).value(hasItem("PLANT")))
                .andExpect(jsonPath(slot("CENTER")).value(hasItem("RING_RED")))
                .andExpect(jsonPath(slot("WALL")).value(hasItem(nullValue())))
                .andExpect(jsonPath(item("CLOCK", "owned")).value(hasItem(false)))
                .andExpect(jsonPath(item("CLOCK", "goal")).value(hasItem(7)))
                .andExpect(jsonPath(item("CLOCK", "hint")).value(hasItem("운동 출석 7일")))
                .andExpect(jsonPath("$.owned").value(2));

        // 아직 못 얻은 건 못 놓는다
        place(alice, "WALL", "CLOCK").andExpect(status().isBadRequest());

        // 운동 출석 7일 → 벽시계
        for (int i = 0; i < 7; i++) {
            em.persist(AttendanceLog.builder().user(alice).date(LocalDate.now().minusDays(i)).didWorkout(true).build());
        }
        em.flush();
        place(alice, "WALL", "CLOCK")
                .andExpect(status().isOk())
                .andExpect(jsonPath(slot("WALL")).value(hasItem("CLOCK")))
                .andExpect(jsonPath(item("CLOCK", "progress")).value(hasItem(7)));
        // 맞지 않는 자리 · 모르는 자리는 거절
        place(alice, "COUNTER", "CLOCK").andExpect(status().isBadRequest());
        place(alice, "ROOF", "CLOCK").andExpect(status().isBadRequest());

        // 3대: 스쿼트는 운동 기록, 벤치 · 데드는 예전 3대 입력으로도 센다 → 트로피 · 플랫 벤치
        em.persist(LiftEntry.builder().user(alice).performedOn(LocalDate.now()).exercise("SQUAT").weightKg(100).reps(5).sets(3).e1rm(116.7).build());
        em.persist(UserBodyStats.builder().user(alice).gender(Gender.FEMALE).weightKg(58.0).benchKg(50.0).deadliftKg(110.0).build());
        em.flush();
        place(alice, "WALL", "TROPHY").andExpect(jsonPath(slot("WALL")).value(hasItem("TROPHY")));
        // 몸무게를 넣었으니 체중계도
        place(alice, "CHECKIN_SIDE", "SCALE").andExpect(jsonPath(slot("CHECKIN_SIDE")).value(hasItem("SCALE")));
        place(alice, "FLOOR_LEFT", "BENCH").andExpect(jsonPath(slot("FLOOR_LEFT")).value(hasItem("BENCH")));

        // 다른 자리로 옮기면 원래 자리는 빈다
        place(alice, "COUNTER", "TROPHY")
                .andExpect(jsonPath(slot("COUNTER")).value(hasItem("TROPHY")))
                .andExpect(jsonPath(slot("WALL")).value(hasItem(nullValue())));

        // 화분은 여러 자리에. 비우면 그 자리만 빈다
        place(alice, "CORNER_LEFT", null)
                .andExpect(jsonPath(slot("CORNER_LEFT")).value(hasItem(nullValue())))
                .andExpect(jsonPath(slot("CORNER_TOP")).value(hasItem("PLANT")));
        place(alice, "CORNER_LEFT", "PLANT").andExpect(jsonPath(slot("CORNER_LEFT")).value(hasItem("PLANT")));

        // 밥은 영향 없음
        mvc.perform(get("/api/gym-decor").with(as(bob)))
                .andExpect(jsonPath(slot("COUNTER")).value(hasItem(nullValue())))
                .andExpect(jsonPath(item("TROPHY", "owned")).value(hasItem(false)));

        // 로그인 없이는 못 본다
        mvc.perform(get("/api/gym-decor")).andExpect(status().is4xxClientError());
    }
}
