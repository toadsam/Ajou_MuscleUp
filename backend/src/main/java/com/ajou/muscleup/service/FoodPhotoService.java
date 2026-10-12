package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.FoodSource;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.security.RateLimiter;
import com.ajou.muscleup.security.UploadFileTypes;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 음식 사진 → 확인 화면에 보여 줄 후보(식단 기록 PR C). <b>여기서는 저장하지 않는다</b> — 사용자가 확인 화면에서 고르고 고친 뒤
 * 기존 POST /api/diet/entries(source=PHOTO)로 저장한다. 사진도 저장하지 않는다(분석에만 쓰고 버림).
 *
 * 영양값은 AI 추정보다 음식 검색 DB(FoodCatalogService, 식약처 · 농진청)를 먼저 쓴다: AI 가 준 search_name 으로 검색해
 * 후보 3개를 붙이고, 첫 후보의 100g 값 × AI 가 추정한 양으로 계산한다. 못 찾으면 AI 추정값.
 */
@Service
@RequiredArgsConstructor
public class FoodPhotoService {
    static final int MAX_BYTES = 6 * 1024 * 1024;
    static final List<String> ALLOWED = List.of("image/jpeg", "image/png", "image/webp");

    private final FoodPhotoRecognizer recognizer;
    private final FoodCatalogService catalog;
    private final RateLimiter rateLimiter;
    private final Clock clock;

    /** 하루에 사진 분석을 몇 번까지(OpenAI 비용 · 남용 방지) */
    @Value("${diet.photo.daily-limit:10}")
    private int dailyLimit;

    /** matches: DB 후보(첫 번째가 기본 선택). food 가 null 이면 AI 추정값(kcal …)을 그대로 쓴다 */
    public record Candidate(String name, String searchName, double grams, double confidence,
                            Double aiKcal, Double aiProteinG, Double aiCarbG, Double aiFatG,
                            List<FoodCatalogService.FoodView> matches) {}

    public record PhotoResult(boolean food, List<Candidate> items, boolean catalogReady, int dailyLimit) {}

    public PhotoResult analyze(User me, byte[] image) {
        if (image == null || image.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "사진을 골라 주세요.");
        }
        if (image.length > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "사진이 너무 커요(6MB까지).");
        }
        // 파일 이름 · Content-Type 은 믿지 않고 앞부분 바이트로 판별
        UploadFileTypes.Detected type = UploadFileTypes.detect(Arrays.copyOf(image, Math.min(image.length, UploadFileTypes.HEADER_BYTES)));
        if (type == null || !ALLOWED.contains(type.contentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JPG · PNG · WEBP 사진만 분석할 수 있어요.");
        }
        LocalDate today = LocalDate.now(clock);
        rateLimiter.check("diet-photo:" + me.getId() + ":" + today, dailyLimit, Duration.ofHours(25),
                "사진 분석은 하루 " + dailyLimit + "번까지예요. 내일 다시 쓰거나 직접 적어 주세요.");

        FoodPhotoRecognizer.Result r = recognizer.recognize(image, type.contentType());
        List<Candidate> out = new ArrayList<>();
        boolean ready = true;
        for (FoodPhotoRecognizer.Recognized it : r.items()) {
            double grams = it.grams() > 0 && it.grams() <= 3000 ? Math.round(it.grams()) : 100;
            FoodCatalogService.SearchResult found = catalog.search(it.searchName());
            ready &= found.ready();
            List<FoodCatalogService.FoodView> matches = pickMatches(found.items(), it.name());
            out.add(new Candidate(it.name(), it.searchName(), grams, it.confidence(),
                    it.kcal(), it.proteinG(), it.carbG(), it.fatG(), matches));
        }
        return new PhotoResult(r.food() && !out.isEmpty(), out, ready, dailyLimit);
    }

    /**
     * 후보 3개: AI 가 포장에서 읽은 브랜드의 제품 → 원재료 · 음식(일반 값) → 그 밖의 제품 순.
     * (검색 결과는 이미 순위대로 — 여기서는 그 순서를 지키며 세 묶음으로 나누기만)
     */
    private static List<FoodCatalogService.FoodView> pickMatches(List<FoodCatalogService.FoodView> items, String aiName) {
        String flatName = FoodCatalogService.normalize(aiName);
        List<FoodCatalogService.FoodView> branded = new ArrayList<>();
        List<FoodCatalogService.FoodView> generic = new ArrayList<>();
        List<FoodCatalogService.FoodView> products = new ArrayList<>();
        for (FoodCatalogService.FoodView f : items) {
            if (f.source() != FoodSource.PROCESSED) {
                generic.add(f);
            } else if (f.maker() != null && flatName.contains(FoodCatalogService.normalize(f.maker().split(" ")[0]))) {
                branded.add(f);
            } else {
                products.add(f);
            }
        }
        List<FoodCatalogService.FoodView> out = new ArrayList<>(branded);
        out.addAll(generic);
        out.addAll(products);
        return out.size() > 3 ? List.copyOf(out.subList(0, 3)) : out;
    }
}
