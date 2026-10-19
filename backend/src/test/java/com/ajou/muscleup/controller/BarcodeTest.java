package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.BarcodeProductSource;
import com.ajou.muscleup.service.BarcodeService;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 식단 바코드: 바코드 정보의 제품 이름 → 음식 검색 후보(같은 이름 · 같은 회사 먼저), 형식 검사, 하루 한도, 캐시. 식약처 API 는 가짜로 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "diet.barcode.daily-limit=4")
class BarcodeTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired FoodCatalogService catalog;
    @MockitoBean BarcodeProductSource source;

    private User alice;

    private static final String TSV = String.join("\n",
            "src\tname\tmaker\tbasis\tkcal\tprotein\tfat\tcarb\tserving_g\tpackage_g",
            "P\t신라면툼바\t농심\t100g\t431\t8\t17\t60\t\t",
            "P\t신라면\t다른회사\t100g\t440\t9\t16\t65\t\t",
            "P\t신라면\t농심\t100g\t438\t9\t16\t66\t\t120",
            "P\t서울우유 저지방\t서울우유협동조합\t100ml\t45\t3\t1\t5\t\t200",
            "P\t서울우유\t서울우유협동조합\t100ml\t65\t3\t3.6\t5\t\t1000",
            "");

    @BeforeEach
    void setUp() throws Exception {
        alice = users.save(User.builder().name("bc").email("bc-alice@test.local").password("x").role("ROLE_USER")
                .nickname("bc-alice").createdAt(LocalDateTime.now()).build());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream z = new GZIPOutputStream(out)) {
            z.write(TSV.getBytes(StandardCharsets.UTF_8));
        }
        byte[] data = out.toByteArray();
        catalog.load(() -> new ByteArrayInputStream(data));
        when(source.enabled()).thenReturn(true);
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    @Test
    void productNameFindsSameNameSameMakerFirst() throws Exception {
        // 같은 바코드에 줄이 여러 개 — 생산 종료 줄보다 생산 중인 줄의 이름
        when(source.lookup("8801043014809")).thenReturn(List.of(
                new BarcodeProductSource.Product("신(辛)라면 구버전", "(주)농심", "유탕면", false),
                new BarcodeProductSource.Product("신라면", "(주)농심 부산공장", "유탕면", true)));

        mvc.perform(get("/api/diet/barcode/8801043014809").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(true))
                .andExpect(jsonPath("$.name").value("신라면"))
                .andExpect(jsonPath("$.maker").value("농심"))
                .andExpect(jsonPath("$.category").value("유탕면"))
                .andExpect(jsonPath("$.matches[0].name").value("신라면"))
                .andExpect(jsonPath("$.matches[0].maker").value("농심"))
                .andExpect(jsonPath("$.matches[1].maker").value("다른회사"))
                .andExpect(jsonPath("$.matches[2].name").value("신라면툼바"));
    }

    @Test
    void volumeInNameIsDroppedForSearch() throws Exception {
        when(source.lookup("8801115114154")).thenReturn(List.of(
                new BarcodeProductSource.Product("서울우유 1000mL", "서울우유협동조합 안산공장", "우유", true)));

        mvc.perform(get("/api/diet/barcode/8801115114154").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maker").value("서울우유협동조합"))
                .andExpect(jsonPath("$.matches[0].name").value("서울우유"))
                .andExpect(jsonPath("$.matches[0].basis").value("100ml"));
    }

    @Test
    void unknownBarcodeIsNotFoundAndCached() throws Exception {
        when(source.lookup("8809999999999")).thenReturn(List.of());

        mvc.perform(get("/api/diet/barcode/8809999999999").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(false))
                .andExpect(jsonPath("$.matches", hasSize(0)));
        mvc.perform(get("/api/diet/barcode/8809999999999").with(as(alice))).andExpect(status().isOk());
        // 두 번째는 서버 메모리에서
        verify(source, times(1)).lookup("8809999999999");
    }

    @Test
    void rejectsBadCodesLimitsPerDayAndNeedsLogin() throws Exception {
        mvc.perform(get("/api/diet/barcode/12ab").with(as(alice))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/diet/barcode/1234567").with(as(alice))).andExpect(status().isBadRequest());
        verify(source, never()).lookup(any());

        when(source.lookup(any())).thenReturn(List.of());
        for (int i = 0; i < 4; i++) {
            mvc.perform(get("/api/diet/barcode/880000000000" + i).with(as(alice))).andExpect(status().isOk());
        }
        // 하루 4번(테스트 설정) 넘으면 429
        mvc.perform(get("/api/diet/barcode/8800000000009").with(as(alice))).andExpect(status().isTooManyRequests());

        mvc.perform(get("/api/diet/barcode/8801043014809")).andExpect(status().isUnauthorized());
    }

    @Test
    void makerNamesDropCompanyTypeAndFactory() {
        assertThat(BarcodeService.cleanMaker("(주)농심")).isEqualTo("농심");
        assertThat(BarcodeService.cleanMaker("해태가루비(주) 제 2공장")).isEqualTo("해태가루비");
        assertThat(BarcodeService.cleanMaker("(주)오리온제4청주공장")).isEqualTo("오리온");
        assertThat(BarcodeService.cleanMaker("서울우유협동조합 안산공장")).isEqualTo("서울우유협동조합");
        assertThat(BarcodeService.cleanMaker("한국 코카콜라 유한회사")).isEqualTo("한국 코카콜라");
        assertThat(BarcodeService.cleanMaker("(주)")).isNull();
    }

    @Test
    void withoutKeyIsUnavailable() throws Exception {
        when(source.enabled()).thenReturn(false);
        mvc.perform(get("/api/diet/barcode/8801043014809").with(as(alice))).andExpect(status().isServiceUnavailable());
    }
}
