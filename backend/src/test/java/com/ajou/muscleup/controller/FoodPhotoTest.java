package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.FoodCatalogService;
import com.ajou.muscleup.service.FoodPhotoRecognizer;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 식단 사진 인식(PR C): 후보 + DB 영양값 연결, 형식 검사, 하루 한도, PHOTO 로 저장. OpenAI 는 가짜로 바꿔 끼운다 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = "diet.photo.daily-limit=3")
class FoodPhotoTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired FoodCatalogService catalog;
    @MockitoBean FoodPhotoRecognizer recognizer;

    private User alice;

    /** JPEG 앞부분(FF D8 FF)만 맞춘 가짜 사진 */
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 1};

    private static final String TSV = String.join("\n",
            "src\tname\tmaker\tbasis\tkcal\tprotein\tfat\tcarb\tserving_g\tpackage_g",
            "R\t현미밥\t\t100g\t150\t3\t0.8\t33\t210\t",
            "P\t현미밥\t어느회사\t100g\t160\t3.5\t1\t35\t\t210",
            "R\t닭고기, 가슴살, 생것\t\t100g\t106\t23\t1\t0\t\t",
            "P\t닭가슴살 블랙페퍼\t하림\t100g\t115\t24\t1.6\t1\t30\t100",
            "");

    @BeforeEach
    void setUp() throws Exception {
        alice = users.save(User.builder().name("fp").email("fp-alice@test.local").password("x").role("ROLE_USER")
                .nickname("fp-alice").createdAt(LocalDateTime.now()).build());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (GZIPOutputStream z = new GZIPOutputStream(out)) {
            z.write(TSV.getBytes(StandardCharsets.UTF_8));
        }
        byte[] data = out.toByteArray();
        catalog.load(() -> new ByteArrayInputStream(data));
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private static MockMultipartFile image(byte[] bytes) {
        // 파일 이름 · Content-Type 은 일부러 틀리게 — 서버는 바이트로 판별한다
        return new MockMultipartFile("image", "meal.heic", "application/octet-stream", bytes);
    }

    @Test
    void candidatesUseCatalogValuesAndFallBackToAiEstimate() throws Exception {
        when(recognizer.recognize(any(), eq("image/jpeg"))).thenReturn(new FoodPhotoRecognizer.Result(true, List.of(
                new FoodPhotoRecognizer.Recognized("현미밥", "현미밥", 210, 310.0, 6.0, 68.0, 2.0, 0.9),
                new FoodPhotoRecognizer.Recognized("하림 닭가슴살 블랙페퍼", "닭가슴살", 100, 120.0, 22.0, 2.0, 2.0, 0.8),
                new FoodPhotoRecognizer.Recognized("이름 모를 소스", "없는음식", 30, 80.0, 1.0, 6.0, 6.0, 0.3))));

        mvc.perform(multipart("/api/diet/photo").file(image(JPEG)).with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.food").value(true))
                .andExpect(jsonPath("$.dailyLimit").value(3))
                .andExpect(jsonPath("$.items", hasSize(3)))
                // 일반 음식은 원재료 · 음식 값이 먼저(같은 이름 제품은 뒤로)
                .andExpect(jsonPath("$.items[0].grams").value(210.0))
                .andExpect(jsonPath("$.items[0].matches[0].source").value("RAW"))
                .andExpect(jsonPath("$.items[0].matches[1].maker").value("어느회사"))
                // AI 가 브랜드(하림)를 읽었으면 그 제품이 먼저
                .andExpect(jsonPath("$.items[1].matches[0].maker").value("하림"))
                // DB 에 없으면 후보 없음 → 화면이 AI 추정값을 쓴다
                .andExpect(jsonPath("$.items[2].matches", hasSize(0)))
                .andExpect(jsonPath("$.items[2].aiKcal").value(80.0));
    }

    @Test
    void rejectsNonImagesAndLimitsPerDay() throws Exception {
        when(recognizer.recognize(any(), any())).thenReturn(new FoodPhotoRecognizer.Result(false, List.of()));

        mvc.perform(multipart("/api/diet/photo").file(image("not an image at all".getBytes(StandardCharsets.UTF_8))).with(as(alice)))
                .andExpect(status().isBadRequest());
        verify(recognizer, never()).recognize(any(), any());

        // 음식이 아닌 사진 → food=false
        mvc.perform(multipart("/api/diet/photo").file(image(JPEG)).with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.food").value(false));
        mvc.perform(multipart("/api/diet/photo").file(image(JPEG)).with(as(alice))).andExpect(status().isOk());
        mvc.perform(multipart("/api/diet/photo").file(image(JPEG)).with(as(alice))).andExpect(status().isOk());
        // 하루 3번(테스트 설정) 넘으면 429
        mvc.perform(multipart("/api/diet/photo").file(image(JPEG)).with(as(alice))).andExpect(status().isTooManyRequests());

        mvc.perform(multipart("/api/diet/photo").file(image(JPEG))).andExpect(status().isUnauthorized());
    }

    @Test
    void savedFromPhotoKeepsPhotoSourceOnly() throws Exception {
        mvc.perform(post("/api/diet/entries").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mealType\":\"LUNCH\",\"name\":\"현미밥\",\"amount\":\"210g\",\"kcal\":315,\"source\":\"PHOTO\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("PHOTO"));
        // 다른 값(INBODY 등)은 직접 입력으로
        mvc.perform(post("/api/diet/entries").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mealType\":\"LUNCH\",\"name\":\"현미밥\",\"source\":\"INBODY\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("MANUAL"));
    }
}
