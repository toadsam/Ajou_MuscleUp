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
                .andExpect(jsonPath("$.owned").value(3)) // 화분 · 빨간 원 · 고무 매트(직원 겉모습은 세지 않는다)
                .andExpect(jsonPath("$.total").value(33));

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

    @Test
    void themeStaffAndLooks() throws Exception {
        // 처음: 고무 매트 · 노란 조끼 · 직원마다 기본 머리색, 새 직원은 아직 없음
        mvc.perform(get("/api/gym-decor").with(as(alice)))
                .andExpect(jsonPath(slot("THEME")).value(hasItem("THEME_RUBBER")))
                .andExpect(jsonPath(slot("UNIFORM")).value(hasItem("UNIFORM_YELLOW")))
                .andExpect(jsonPath(slot("HAIR_OWNER")).value(hasItem("HAIR_GRAY")))
                .andExpect(jsonPath(slot("HIRE_TRAINER")).value(hasItem(nullValue())))
                .andExpect(jsonPath(item("TRAINER", "kind")).value(hasItem("STAFF")))
                .andExpect(jsonPath(item("TRAINER", "hint")).value(hasItem("운동 세션 20번")));

        // 겉모습은 처음부터. 머리색은 여러 직원이 같이 쓸 수 있다
        place(alice, "UNIFORM", "UNIFORM_ORANGE").andExpect(jsonPath(slot("UNIFORM")).value(hasItem("UNIFORM_ORANGE")));
        place(alice, "HAIR_COACH", "HAIR_BLOND").andExpect(status().isOk());
        place(alice, "HAIR_OWNER", "HAIR_BLOND")
                .andExpect(jsonPath(slot("HAIR_COACH")).value(hasItem("HAIR_BLOND")))
                .andExpect(jsonPath(slot("HAIR_OWNER")).value(hasItem("HAIR_BLOND")));
        place(alice, "UNIFORM", "HAIR_BLACK").andExpect(status().isBadRequest());

        // 새 직원 · 테마는 기록이 있어야
        place(alice, "HIRE_TRAINER", "TRAINER").andExpect(status().isBadRequest());
        place(alice, "THEME", "THEME_BRICK").andExpect(status().isBadRequest());

        // 3대 합계: 종목마다 운동 기록 최고와 예전 입력 중 큰 값 → 140 + 60 + 110 = 310kg
        em.persist(LiftEntry.builder().user(alice).performedOn(LocalDate.now()).exercise("SQUAT").weightKg(140).reps(1).sets(1).e1rm(140).build());
        em.persist(UserBodyStats.builder().user(alice).gender(Gender.MALE).weightKg(80.0).squatKg(100.0).benchKg(60.0).deadliftKg(110.0).build());
        em.flush();
        place(alice, "THEME", "THEME_BRICK")
                .andExpect(jsonPath(slot("THEME")).value(hasItem("THEME_BRICK")))
                .andExpect(jsonPath(item("THEME_BRICK", "progress")).value(hasItem(300)));

        // 운동 출석 14일 → 청소 알바 출근, 비우면 쉰다
        for (int i = 0; i < 14; i++) {
            em.persist(AttendanceLog.builder().user(alice).date(LocalDate.now().minusDays(i)).didWorkout(true).build());
        }
        em.flush();
        place(alice, "HIRE_CLEANER", "CLEANER").andExpect(jsonPath(slot("HIRE_CLEANER")).value(hasItem("CLEANER")));
        place(alice, "HIRE_CLEANER", null).andExpect(jsonPath(slot("HIRE_CLEANER")).value(hasItem(nullValue())));
    }

    @Test
    void spacesUnlockFromRecords() throws Exception {
        // 처음: 새 공간은 잠겨 있고, 그 공간 자리에는 아무것도 놓을 수 없다
        mvc.perform(get("/api/gym-decor").with(as(alice)))
                .andExpect(jsonPath(item("SPACE_TRACK", "owned")).value(hasItem(false)))
                .andExpect(jsonPath(item("SPACE_TRACK", "hint")).value(hasItem("러닝 누적 30km")))
                .andExpect(jsonPath(item("SPACE_FLOOR2", "hint")).value(hasItem("꾸미기 물품 6개 얻기")))
                .andExpect(jsonPath(slot("DN_CORNER_L")).value(hasItem("PLANT")));
        place(alice, "TR_FIELD_A", "PLANT").andExpect(status().isBadRequest());

        // 러닝 6번 · 누적 30km → 트랙이 열리고, 콘(러닝 5번)도 얻는다
        for (int i = 0; i < 6; i++) {
            em.persist(com.ajou.muscleup.entity.RunSession.builder().user(alice).performedOn(LocalDate.now().minusDays(i))
                    .startedAt(LocalDateTime.now().minusDays(i).minusHours(1)).endedAt(LocalDateTime.now().minusDays(i))
                    .durationSec(1800).distanceM(5000).source("GPS").build());
        }
        em.flush();
        place(alice, "TR_FIELD_A", "PLANT").andExpect(jsonPath(slot("TR_FIELD_A")).value(hasItem("PLANT")));
        place(alice, "TR_LINE", "CONE").andExpect(jsonPath(slot("TR_LINE")).value(hasItem("CONE")));
        // 결승 깃발은 100km, 트랙 전용 물품은 1층에 못 놓는다
        place(alice, "TR_LINE", "FINISH_FLAG").andExpect(status().isBadRequest());
        place(alice, "FLOOR_LEFT", "CONE").andExpect(status().isBadRequest());
        // 아직 잠긴 식당 자리
        place(alice, "DN_CORNER_L", null).andExpect(status().isBadRequest());
    }
}
