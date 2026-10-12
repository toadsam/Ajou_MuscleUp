package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.FoodCatalogService;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.zip.GZIPOutputStream;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 음식 검색(PR B): 파일 → 메모리 읽기, 검색 순서, 띄어쓰기 · 업체명 · 비슷한 말 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FoodSearchTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired FoodCatalogService catalog;

    private User alice;

    private static final String TSV = String.join("\n",
            "src\tname\tmaker\tbasis\tkcal\tprotein\tfat\tcarb\tserving_g\tpackage_g",
            "P\t한입쏙 닭가슴살 허브갈릭\t하림\t100g\t130\t19\t2\t9\t\t350",
            "P\t닭가슴살 스테이크 오리지널\t다른회사\t100g\t120\t20\t2.5\t4\t50\t100",
            "R\t닭고기, 가슴살, 생것\t\t100g\t106\t22.9\t0.97\t0\t\t",
            "R\t닭가슴살 패티\t\t100g\t145\t17.8\t4\t9.6\t\t",
            "D\t샐러드_닭가슴살\t\t100g\t135\t7.2\t9.5\t5.4\t150\t",
            "X\t알 수 없는 종류\t\t100g\t1\t1\t1\t1\t\t",
            "R\t현미밥\t\t100g\t153\t3.1\t0.8\t33\t210\t",
            "P\t바나나\t해외상사\t100g\t454\t3\t20\t60\t\t200",
            "R\t바나나, 생것\t\t100g\t77\t1.1\t0.2\t20\t\t",
            "D\t계란말이\t\t100g\t180\t11\t13\t4\t100\t",
            "R\t달걀, 전란, 생것\t\t100g\t136\t12.4\t9\t0.7\t\t",
            "");

    private static byte[] gz(String s) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream z = new GZIPOutputStream(out)) {
            z.write(s.getBytes(StandardCharsets.UTF_8));
        }
        return out.toByteArray();
    }

    @BeforeEach
    void setUp() throws Exception {
        alice = users.save(User.builder().name("fs").email("fs-alice@test.local").password("x").role("ROLE_USER")
                .nickname("fs-alice").createdAt(LocalDateTime.now()).build());
        byte[] data = gz(TSV);
        // 알 수 없는 종류(X) 한 줄은 건너뛴다
        assertThat(catalog.load(() -> new ByteArrayInputStream(data))).isEqualTo(10);
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    @Test
    void searchesByNameMakerAndIgnoresSpaces() throws Exception {
        // "하림 닭가슴살" — 업체명 + 이름 두 단어 모두 맞는 것만
        mvc.perform(get("/api/diet/foods").param("q", "하림 닭가슴살").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ready").value(true))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].maker").value("하림"))
                .andExpect(jsonPath("$.items[0].source").value("PROCESSED"))
                .andExpect(jsonPath("$.items[0].kcal").value(130.0))
                .andExpect(jsonPath("$.items[0].packageG").value(350.0));

        // 한 단어: 이름이 그 말로 시작하는 것 먼저, 같으면 원재료 → 음식 → 제품
        mvc.perform(get("/api/diet/foods").param("q", "닭가슴살").with(as(alice)))
                // 비슷한 말(닭고기가슴살)로 원재료 "닭고기, 가슴살, 생것"도 찾는다
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].name").value("닭가슴살 패티"))
                .andExpect(jsonPath("$.items[1].name").value("닭고기, 가슴살, 생것"))
                .andExpect(jsonPath("$.items[2].name").value("닭가슴살 스테이크 오리지널"))
                .andExpect(jsonPath("$.items[4].name").value("한입쏙 닭가슴살 허브갈릭"));

        // 원재료는 쉼표 앞 이름으로도 맞춰 본다: "바나나" → "바나나, 생것"이 같은 이름의 제품보다 먼저
        mvc.perform(get("/api/diet/foods").param("q", "바나나").with(as(alice)))
                .andExpect(jsonPath("$.items[0].name").value("바나나, 생것"))
                .andExpect(jsonPath("$.items[1].maker").value("해외상사"));

        // 비슷한 말: "계란" 으로 원재료 "달걀" 도 찾고, 그게 먼저
        mvc.perform(get("/api/diet/foods").param("q", "계란").with(as(alice)))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].name").value("달걀, 전란, 생것"))
                .andExpect(jsonPath("$.items[1].name").value("계란말이"));

        // 띄어쓰기 · 밑줄 무시
        mvc.perform(get("/api/diet/foods").param("q", "샐러드 닭가슴살").with(as(alice)))
                .andExpect(jsonPath("$.items[0].name").value("샐러드_닭가슴살"));
        mvc.perform(get("/api/diet/foods").param("q", "현미 밥").with(as(alice)))
                .andExpect(jsonPath("$.items[0].name").value("현미밥"));

        // 빈 검색어는 빈 목록, 너무 긴 검색어 400, 로그인 필요
        mvc.perform(get("/api/diet/foods").param("q", "  ").with(as(alice))).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get("/api/diet/foods").param("q", "가".repeat(41)).with(as(alice))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/diet/foods").param("q", "닭")).andExpect(status().isUnauthorized());
    }
}
