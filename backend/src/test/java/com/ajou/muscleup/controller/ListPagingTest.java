package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.GroupBuyVisibility;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.Review;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 공동구매 · 후기 목록 페이지 넘김(화면의 "더 보기")과 후기 전체 합계 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ListPagingTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired EntityManager em;

    private User alice;
    private Protein first;
    private Protein second;

    @BeforeEach
    void setUp() {
        alice = users.save(User.builder().name("lp").email("lp-alice@test.local").password("x").role("ROLE_USER")
                .nickname("lp-alice").createdAt(LocalDateTime.now()).build());
        first = protein("페이징 단백질 A");
        second = protein("페이징 단백질 B");
        int[] ratings = {5, 4, 3};
        for (int r : ratings) em.persist(Review.builder().user(alice).protein(first).rating(r).content("후기 " + r).build());
        em.persist(Review.builder().user(alice).protein(second).rating(1).content("별로").build());
        em.flush();
    }

    private Protein protein(String name) {
        Protein p = Protein.builder().owner(alice).name(name).days(7).visibility(GroupBuyVisibility.PUBLIC).build();
        em.persist(p);
        return p;
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    @Test
    void reviewsPageAndSummaryCoverEverything() throws Exception {
        // 한 페이지 2개씩: 첫 페이지는 마지막이 아니고, 다음 페이지에 나머지
        mvc.perform(get("/api/reviews?size=2&page=0&proteinId=" + first.getId()).with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.last").value(false))
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/reviews?size=2&page=1&proteinId=" + first.getId()).with(as(alice)))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.last").value(true));

        // 합계는 페이지와 상관없이 전체: 제품 하나(5·4·3 → 4.0, 3개)
        mvc.perform(get("/api/reviews/summary?proteinId=" + first.getId()).with(as(alice)))
                .andExpect(jsonPath("$.avg").value(4.0))
                .andExpect(jsonPath("$.count").value(3));
        // 전체 후기 합계에는 다른 제품 후기도 들어간다(이 테스트 밖 데이터가 있을 수 있어 개수는 4 이상)
        mvc.perform(get("/api/reviews/summary").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(org.hamcrest.Matchers.greaterThanOrEqualTo(4)));
        // 후기 없는 제품은 0
        Protein empty = protein("후기 없는 단백질");
        em.flush();
        mvc.perform(get("/api/reviews/summary?proteinId=" + empty.getId()).with(as(alice)))
                .andExpect(jsonPath("$.avg").value(0.0))
                .andExpect(jsonPath("$.count").value(0));
        // 로그인 필요
        mvc.perform(get("/api/reviews/summary")).andExpect(status().is4xxClientError());
    }

    @Test
    void proteinsPageReportsLast() throws Exception {
        mvc.perform(get("/api/proteins?scope=all&size=1&page=0").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.last").value(false));
    }
}
