package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.jayway.jsonpath.JsonPath;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 공동구매 모집 범위(docs/design/stage0-gyms.md §2-1):
 * 우리 모임만 → 그 모임 멤버만 보고 신청, 전체 모집 → 누구나 보지만 여는 사람 조건(가입 7일 · 운동 3일) 있음.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GroupBuyScopeTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired WorkoutCrewRepository gyms;
    @Autowired WorkoutCrewMemberRepository members;
    @Autowired AttendanceLogRepository attendance;

    private User member;
    private User outsider;
    private User veteran;

    @BeforeEach
    void setUp() {
        member = save("gb-member@test.local", LocalDateTime.now());
        outsider = save("gb-outsider@test.local", LocalDateTime.now());
        veteran = save("gb-veteran@test.local", LocalDateTime.now().minusDays(30));
        for (int i = 1; i <= 3; i++) {
            attendance.save(AttendanceLog.builder().user(veteran).date(LocalDate.now().minusDays(i)).didWorkout(true).build());
        }
        WorkoutCrew gym = gyms.save(WorkoutCrew.builder().name("공구 테스트 모임").owner(member).inviteCode("GBTEST01")
                .type(GymType.CREW).slug("gb-test-gym").status(GymStatus.ACTIVE).features(EnumSet.allOf(GymFeature.class)).build());
        members.save(WorkoutCrewMember.builder().crew(gym).user(member).role(WorkoutCrewMemberRole.OWNER).build());
    }

    private User save(String email, LocalDateTime createdAt) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER").nickname(email.substring(0, 10)).createdAt(createdAt).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    private long create(User owner, String body) throws Exception {
        String res = mvc.perform(post("/api/proteins").with(as(owner)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(res, "$.id")).longValue();
    }

    @Test
    void gymOnlyGroupBuyIsHiddenFromOutsiders() throws Exception {
        long id = create(member, "{\"name\":\"모임 단백질\",\"days\":7,\"gymSlug\":\"gb-test-gym\",\"visibility\":\"GYM\",\"maxParticipants\":2}");

        mvc.perform(get("/api/proteins/" + id).with(as(member))).andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("GYM")).andExpect(jsonPath("$.gymSlug").value("gb-test-gym"));
        // 바깥 사람: 상세 404 · 신청 404 · 목록에 없음
        mvc.perform(get("/api/proteins/" + id).with(as(outsider))).andExpect(status().isNotFound());
        mvc.perform(post("/api/proteins/" + id + "/applications").with(as(outsider))).andExpect(status().isNotFound());
        mvc.perform(get("/api/proteins?size=50").with(as(outsider)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isEmpty());
        // 멤버: "우리 모임" 탭에 있고 "전체" 탭에는 없음
        mvc.perform(get("/api/proteins?scope=gym&size=50").with(as(member)))
                .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isNotEmpty());
        mvc.perform(get("/api/proteins?scope=public&size=50").with(as(member)))
                .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isEmpty());
        // 멤버가 아닌 모임 이름으로 거르기 → 403
        mvc.perform(get("/api/proteins?gym=gb-test-gym").with(as(outsider))).andExpect(status().isForbidden());
        // 멤버가 아닌 모임에서 열기 → 403
        mvc.perform(post("/api/proteins").with(as(outsider)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"days\":7,\"gymSlug\":\"gb-test-gym\",\"visibility\":\"GYM\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void publicGroupBuyNeedsTrustedOpenerAndIsVisibleToAll() throws Exception {
        // 갓 가입 · 운동 0일 → 전체 모집 못 엶
        mvc.perform(post("/api/proteins").with(as(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"전체 단백질\",\"days\":7,\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isForbidden());
        // 가입 30일 · 운동 3일 → 열 수 있고, 바깥 사람도 보고 신청 가능 · 신뢰 표시
        long id = create(veteran, "{\"name\":\"전체 단백질\",\"days\":7,\"visibility\":\"PUBLIC\",\"region\":\"수원\"}");
        mvc.perform(get("/api/proteins/" + id).with(as(outsider))).andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.region").value("수원"))
                .andExpect(jsonPath("$.ownerWorkoutDays").value(3))
                .andExpect(jsonPath("$.ownerEmail").doesNotExist());
        mvc.perform(post("/api/proteins/" + id + "/applications").with(as(outsider))).andExpect(status().isOk());
        mvc.perform(get("/api/proteins?scope=public&size=50").with(as(outsider)))
                .andExpect(jsonPath("$.content[?(@.id == " + id + ")]").isNotEmpty());
    }

    @Test
    void gymRankingIsForMembersOnly() throws Exception {
        // 짐 안 랭킹(같은 짐 멤버끼리)은 멤버만 볼 수 있다
        mvc.perform(get("/api/rankings/characters?gym=gb-test-gym").with(as(outsider))).andExpect(status().isForbidden());
        mvc.perform(get("/api/rankings/characters?gym=gb-test-gym&type=THREE_LIFT").with(as(member))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
        mvc.perform(get("/api/rankings/characters?gym=no-such-gym").with(as(member))).andExpect(status().isNotFound());
    }
}
