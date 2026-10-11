package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.GymVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
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

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 라운지 방 입장권(0단계 PR 7): 광장은 누구나, 모임 방은 그 모임 멤버만(라운지 기능이 켜진 운영 중 모임).
 * 방은 서명된 입장권 안에만 들어가므로 실시간 서버는 클라이언트 말을 믿지 않아도 된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RealtimeTicketRoomTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired WorkoutCrewRepository gyms;
    @Autowired WorkoutCrewMemberRepository members;

    private User member;
    private User outsider;
    private WorkoutCrew gym;

    @BeforeEach
    void setUp() {
        member = save("rt-member@test.local");
        outsider = save("rt-outsider@test.local");
        gym = gyms.save(WorkoutCrew.builder().name("라운지 모임").owner(member).inviteCode("RTROOM01").type(GymType.CREW)
                .slug("rt-room-gym").visibility(GymVisibility.PUBLIC).status(GymStatus.ACTIVE)
                .features(EnumSet.allOf(GymFeature.class)).build());
        members.save(WorkoutCrewMember.builder().crew(gym).user(member).role(WorkoutCrewMemberRole.OWNER).build());
        gyms.save(WorkoutCrew.builder().name("라운지 끈 모임").owner(member).inviteCode("RTROOM02").type(GymType.CREW)
                .slug("rt-no-lounge").visibility(GymVisibility.PUBLIC).status(GymStatus.ACTIVE)
                .features(EnumSet.of(GymFeature.ATTENDANCE)).build());
        members.save(WorkoutCrewMember.builder().crew(gyms.findBySlug("rt-no-lounge").orElseThrow()).user(member)
                .role(WorkoutCrewMemberRole.OWNER).build());
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 10)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    /** 입장권 앞부분(서명 전 본문)을 풀어 본다 */
    private static String claimsOf(String responseJson) {
        String ticket = JsonPath.read(responseJson, "$.ticket");
        return new String(Base64.getUrlDecoder().decode(ticket.substring(0, ticket.indexOf('.'))), StandardCharsets.UTF_8);
    }

    @Test
    void squareIsDefault() throws Exception {
        String res = mvc.perform(post("/api/realtime/ticket").with(as(outsider)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room").value("square"))
                .andReturn().getResponse().getContentAsString();
        assertThat(claimsOf(res)).contains("\"room\":\"square\"");
    }

    @Test
    void gymRoomOnlyForMembers() throws Exception {
        String res = mvc.perform(post("/api/realtime/ticket").with(as(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"room\":\"gym:rt-room-gym\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.room").value("gym:" + gym.getId()))
                .andExpect(jsonPath("$.roomName").value("라운지 모임"))
                .andReturn().getResponse().getContentAsString();
        assertThat(claimsOf(res)).contains("\"room\":\"gym:" + gym.getId() + "\"");

        mvc.perform(post("/api/realtime/ticket").with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"room\":\"gym:rt-room-gym\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/realtime/ticket").with(as(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"room\":\"gym:rt-no-lounge\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/realtime/ticket").with(as(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"room\":\"lobby\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/realtime/ticket").with(as(member))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"room\":\"gym:no-such-gym\"}"))
                .andExpect(status().isNotFound());
    }
}
