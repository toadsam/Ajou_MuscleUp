package com.ajou.muscleup.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 회원 명단 권한: 로그인 안 하면 못 보고, 바꾸기는 관리자만. (테스트 끝나면 되돌림) */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ClubRosterControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void anonymousCannotReadRoster() throws Exception {
        mvc.perform(get("/api/club/roster")).andExpect(status().is4xxClientError());
    }

    @Test
    void memberCannotReplaceRoster() throws Exception {
        mvc.perform(put("/api/admin/club/roster").with(user("member@test.local").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"names\":[\"가\"]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminReplacesAndMemberReads() throws Exception {
        mvc.perform(put("/api/admin/club/roster").with(user("admin@test.local").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"names\":[\" 테스트일 \",\"테스트이\",\"테스트일\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.names.length()").value(2));
        mvc.perform(get("/api/club/roster").with(user("member@test.local").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.names[0]").value("테스트일"))
                .andExpect(jsonPath("$.names[1]").value("테스트이"));
    }
}
