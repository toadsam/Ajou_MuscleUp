package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
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

import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 짐 API 흐름: 만들기(승인 대기) → 운영자 승인 → 공개 · 운영진 임명 · 권한 경계.
 * 실제 서비스처럼 principal 이 이메일 문자열이 되게 인증을 넣는다. 테스트가 끝나면 DB 를 되돌린다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GymControllerTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired WorkoutCrewRepository gyms;
    @Autowired WorkoutCrewMemberRepository members;

    private User owner;
    private User staff;
    private User outsider;

    @BeforeEach
    void setUp() {
        owner = save("gym-owner@test.local", "ROLE_USER");
        staff = save("gym-staff@test.local", "ROLE_USER");
        outsider = save("gym-outsider@test.local", "ROLE_USER");
        save("gym-admin@test.local", "ROLE_ADMIN");
    }

    private User save(String email, String role) {
        return users.save(User.builder().name(email).email(email).password("x").role(role).nickname(email.substring(0, 12)).build());
    }

    private static RequestPostProcessor as(String email, String role) {
        return authentication(new UsernamePasswordAuthenticationToken(email, null, List.of(new SimpleGrantedAuthority(role))));
    }

    private static final String CREATE = "{\"name\":\"테스트 러닝크루\",\"slug\":\"test-run-crew\",\"type\":\"CREW\"}";

    @Test
    void createApproveAndStaffFlow() throws Exception {
        // 일반 사용자가 만들면 승인 대기 → 로그인 안 한 사람에게는 없는 짐
        mvc.perform(post("/api/gyms").with(as(owner.getEmail(), "ROLE_USER")).contentType(MediaType.APPLICATION_JSON).content(CREATE))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.myRole").value("OWNER"));
        mvc.perform(get("/api/gyms/test-run-crew")).andExpect(status().isNotFound());

        // 같은 주소 다시 → 409, 예약어 → 400
        mvc.perform(post("/api/gyms").with(as(outsider.getEmail(), "ROLE_USER")).contentType(MediaType.APPLICATION_JSON).content(CREATE))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/gyms").with(as(outsider.getEmail(), "ROLE_USER")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"slug\":\"admin\",\"type\":\"CREW\"}"))
                .andExpect(status().isBadRequest());

        // 일반 사용자는 승인 못 함, 운영자 승인 후 공개
        String id = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(get("/api/gyms/test-run-crew").with(as(owner.getEmail(), "ROLE_USER"))).andReturn().getResponse().getContentAsString(),
                "$.id").toString();
        mvc.perform(post("/api/admin/gyms/" + id + "/approve").with(as(owner.getEmail(), "ROLE_USER"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/gyms/" + id + "/approve").with(as("gym-admin@test.local", "ROLE_ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(get("/api/gyms/test-run-crew")).andExpect(status().isOk()).andExpect(jsonPath("$.inviteCode").doesNotExist());

        // 가입 안 한 사람은 멤버 목록 못 봄, 운영진 소개는 누구나
        mvc.perform(get("/api/gyms/test-run-crew/members").with(as(outsider.getEmail(), "ROLE_USER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/gyms/test-run-crew/members?role=STAFF")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));

        // 바깥 사람은 설정 못 바꿈, 멤버가 아닌 사람은 운영진으로 못 정함
        mvc.perform(patch("/api/gyms/test-run-crew").with(as(outsider.getEmail(), "ROLE_USER")).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"뺏기\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/gyms/test-run-crew/members/" + staff.getId()).with(as(owner.getEmail(), "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"STAFF\",\"title\":\"코치\"}"))
                .andExpect(status().isNotFound());

        // 멤버로 들어온 사람을 운영진으로 → 운영진은 멤버 목록은 보지만 설정 · 운영진 지정은 못 함
        members.save(WorkoutCrewMember.builder().crew(gyms.findBySlug("test-run-crew").orElseThrow()).user(staff).role(WorkoutCrewMemberRole.MEMBER).build());
        mvc.perform(patch("/api/gyms/test-run-crew/members/" + staff.getId()).with(as(owner.getEmail(), "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"STAFF\",\"title\":\"코치\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("STAFF")).andExpect(jsonPath("$.title").value("코치"));
        mvc.perform(get("/api/gyms/test-run-crew/members").with(as(staff.getEmail(), "ROLE_USER")))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2))).andExpect(jsonPath("$[0].role").value("OWNER"));
        mvc.perform(patch("/api/gyms/test-run-crew").with(as(staff.getEmail(), "ROLE_USER")).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"바꾸기\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/gyms/test-run-crew/members/" + owner.getId()).with(as(staff.getEmail(), "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"MEMBER\"}"))
                .andExpect(status().isForbidden());
        // 모임장 자신의 역할은 못 바꿈
        mvc.perform(patch("/api/gyms/test-run-crew/members/" + owner.getId()).with(as(owner.getEmail(), "ROLE_USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"MEMBER\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void crewScreenListsOnlyCrews() throws Exception {
        // 운동 모임 화면(/api/crew/groups)에는 동아리(CLUB) 같은 큰 짐이 섞이지 않는다
        mvc.perform(post("/api/gyms").with(as("gym-admin@test.local", "ROLE_ADMIN")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"테스트 동아리\",\"slug\":\"test-club\",\"type\":\"CLUB\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(get("/api/crew/groups").with(as(owner.getEmail(), "ROLE_USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == '테스트 동아리')]").isEmpty());
    }

    @Test
    void pendingGymJoinsOnlyByInviteLink() throws Exception {
        // 승인 대기 짐: 번호로 가입 403, 주소만으로는 404, 초대 코드가 맞으면 보이고 코드로 가입 가능
        String res = mvc.perform(post("/api/gyms").with(as(owner.getEmail(), "ROLE_USER")).contentType(MediaType.APPLICATION_JSON).content(CREATE))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(res, "$.id").toString();
        String code = com.jayway.jsonpath.JsonPath.read(res, "$.inviteCode");
        mvc.perform(post("/api/crew/groups/" + id + "/join").with(as(outsider.getEmail(), "ROLE_USER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/gyms/test-run-crew").with(as(outsider.getEmail(), "ROLE_USER"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/gyms/test-run-crew?code=WRONGCODE")).andExpect(status().isNotFound());
        mvc.perform(get("/api/gyms/test-run-crew?code=" + code)).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.inviteCode").doesNotExist());
        mvc.perform(post("/api/crew/groups/join-by-code/" + code).with(as(outsider.getEmail(), "ROLE_USER"))).andExpect(status().isOk());
    }
}
