package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.FoodSource;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * 음식 검색(식단 기록 PR B).
 *
 * 데이터: resources/food/foods.tsv.gz — 식약처 K-FIND 가공식품 · 음식 DB, 농진청 국가표준식품성분 DB 에서 검색에 필요한 칸만 추린 것
 * (만드는 법: scripts/food/README.md). 칸: src name maker basis kcal protein fat carb serving_g package_g.
 *
 * <b>DB 에 넣지 않고 서버 메모리에 읽어 둔다.</b> 처음에는 food_items 표에 32만 줄을 넣었는데, 운영 Postgres 볼륨(500MB)이
 * 넣는 도중의 변경 기록(WAL)과 인덱스로 가득 차 DB 가 멈췄다(2026-10-12, docs/fixes/2026-10-12-food-search-incident.md).
 * 바뀌지 않는 참고 자료라 메모리로 충분하다 — 서버가 뜬 뒤 별도 스레드에서 몇 초 안에 읽고, 다 읽기 전에는 ready=false.
 */
@Slf4j
@Service
public class FoodCatalogService {
    static final String RESOURCE = "food/foods.tsv.gz";
    static final int MAX_RESULTS = 30;

    /**
     * 같은 음식을 다르게 부르는 말(검색어 → 데이터 속 이름). 원재료 DB 는 "달걀", "닭고기, 가슴살", "쇠고기"처럼 적혀 있다.
     * 낱말 하나가 이 중 하나면 두 말 모두로 찾는다.
     */
    static final Map<String, String> SYNONYMS = Map.of(
            "계란", "달걀", "달걀", "계란",
            "닭가슴살", "닭고기가슴살",
            "소고기", "쇠고기", "쇠고기", "소고기");

    @Value("${food.catalog.load-on-startup:true}")
    private boolean loadOnStartup;

    /** 읽어 둔 음식(바꿀 때는 목록을 통째로 갈아 끼운다) */
    private volatile List<Item> items = List.of();
    private volatile boolean ready;

    /** 메모리 절약: 숫자는 float(없으면 NaN), 업체 이름은 같은 문자열을 함께 쓴다 */
    private record Item(FoodSource source, String name, String maker, String key, boolean ml,
                        float kcal, float protein, float fat, float carb, float serving, float pack) {}

    public record FoodView(Long id, FoodSource source, String name, String maker, String basis,
                           Double kcal, Double proteinG, Double fatG, Double carbG,
                           Double servingG, Double packageG) {}

    public record SearchResult(boolean ready, List<FoodView> items) {}

    public interface IOSupplier {
        InputStream get() throws IOException;
    }

    /** 이름 · 검색어를 같은 방식으로: 소문자, 글자와 숫자만(띄어쓰기 · 괄호 · 쉼표 · 밑줄 무시) */
    public static String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void loadOnStartup() {
        if (!loadOnStartup) return;
        Thread t = new Thread(() -> {
            try {
                ClassPathResource res = new ClassPathResource(RESOURCE);
                if (!res.exists()) {
                    log.warn("음식 검색 데이터 파일이 없습니다: {}", RESOURCE);
                    return;
                }
                load(res::getInputStream);
            } catch (Exception e) {
                log.error("음식 검색 데이터를 읽지 못했습니다", e);
            }
        }, "food-catalog-loader");
        t.setDaemon(true);
        t.start();
    }

    /** 파일을 읽어 메모리 목록을 갈아 끼운다. 읽은 줄 수를 돌려준다 */
    public int load(IOSupplier source) throws IOException {
        long started = System.currentTimeMillis();
        List<Item> next = new ArrayList<>(330_000);
        Map<String, String> makers = new HashMap<>();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new GZIPInputStream(source.get()), StandardCharsets.UTF_8))) {
            r.readLine(); // 머리줄
            String line;
            while ((line = r.readLine()) != null) {
                String[] c = line.split("\t", -1);
                FoodSource src = parse(c);
                if (src == null) continue;
                String name = c[1].strip();
                String maker = c[2].isBlank() ? null : makers.computeIfAbsent(c[2].strip(), m -> m);
                next.add(new Item(src, name, maker, normalize(name) + " " + normalize(maker), "100ml".equals(c[3]),
                        flt(c[4]), flt(c[5]), flt(c[6]), flt(c[7]), flt(c[8]), flt(c[9])));
            }
        }
        items = List.copyOf(next);
        ready = true;
        log.info("음식 검색 데이터 {}건을 메모리에 읽었습니다({}ms)", next.size(), System.currentTimeMillis() - started);
        return next.size();
    }

    public SearchResult search(String q) {
        List<String> tokens = new ArrayList<>();
        for (String part : (q == null ? "" : q).trim().split("\\s+")) {
            String t = normalize(part);
            if (!t.isEmpty()) tokens.add(t);
            if (tokens.size() == 4) break;
        }
        if (tokens.isEmpty()) return new SearchResult(ready, List.of());
        List<String> alts = tokens.stream().map(t -> SYNONYMS.getOrDefault(t, t)).toList();

        // 순위: 이름이 검색어와 같음 > 검색어로 시작 > 첫 낱말로 시작 > 그 밖(쓴 말 · 비슷한 말 중 더 잘 맞는 쪽),
        // 한 낱말이면 원재료 → 음식 → 제품, 그다음 짧은 이름. 맞는 줄마다 한 번만 계산해 숫자 하나(sort key)로 묶는다
        // ("밥"처럼 수만 줄이 맞을 때 정렬 중에 다시 계산하면 1초 가까이 걸렸다).
        String whole = String.join("", tokens);
        String first = tokens.get(0);
        String altWhole = String.join("", alts);
        String altFirst = alts.get(0);
        boolean single = tokens.size() == 1;

        List<Item> all = items;
        long[] hits = new long[64];
        int count = 0;
        for (int i = 0; i < all.size(); i++) {
            Item it = all.get(i);
            String key = it.key();
            boolean ok = true;
            for (int k = 0; k < tokens.size() && ok; k++) {
                ok = key.contains(tokens.get(k)) || key.contains(alts.get(k));
            }
            if (!ok) continue;
            int rank = Math.min(rankOf(it, whole, first), rankOf(it, altWhole, altFirst));
            int src = single ? sourceOrder(it.source()) : 0;
            long sortKey = ((long) rank << 50) | ((long) src << 44) | ((long) Math.min(it.name().length(), 4095) << 32) | i;
            if (count == hits.length) hits = Arrays.copyOf(hits, count * 2);
            hits[count++] = sortKey;
        }
        Arrays.sort(hits, 0, count);

        List<FoodView> out = new ArrayList<>(Math.min(MAX_RESULTS, count));
        for (int n = 0; n < count && n < MAX_RESULTS; n++) {
            int i = (int) (hits[n] & 0xFFFFFFFFL);
            Item it = all.get(i);
            out.add(new FoodView((long) i, it.source(), it.name(), it.maker(), it.ml() ? "100ml" : "100g",
                    dbl(it.kcal()), dbl(it.protein()), dbl(it.fat()), dbl(it.carb()), dbl(it.serving()), dbl(it.pack())));
        }
        return new SearchResult(ready, out);
    }

    // ---- 내부 ----

    /** 원재료는 "바나나, 생것"처럼 쉼표 뒤가 상태라 쉼표 앞 이름으로도 비교한다 */
    private static int rankOf(Item it, String whole, String first) {
        // key = 정규화한 이름 + " " + 정규화한 업체 → 앞부분이 정규화한 이름(다시 정규화하지 않는다)
        String key = it.key();
        int r = rank(key.substring(0, key.indexOf(' ')), whole, first);
        int comma = it.name().indexOf(',');
        if (it.source() == FoodSource.RAW && comma > 0) {
            r = Math.min(r, rank(normalize(it.name().substring(0, comma)), whole, first));
        }
        return r;
    }

    private static int rank(String name, String whole, String first) {
        if (name.equals(whole)) return 0;
        if (name.startsWith(whole)) return 1;
        if (name.startsWith(first)) return 2;
        return 3;
    }

    /** 한 단어 검색이면 원재료 → 음식 → 제품 순(닭가슴살을 치면 기본 닭가슴살부터) */
    private static int sourceOrder(FoodSource s) {
        return switch (s) {
            case RAW -> 0;
            case DISH -> 1;
            case PROCESSED -> 2;
        };
    }

    /** 넣을 수 있는 줄이면 종류, 아니면 null */
    private static FoodSource parse(String[] c) {
        if (c.length < 10 || c[1].isBlank()) return null;
        return switch (c[0]) {
            case "P" -> FoodSource.PROCESSED;
            case "D" -> FoodSource.DISH;
            case "R" -> FoodSource.RAW;
            default -> null;
        };
    }

    private static float flt(String s) {
        if (s == null || s.isBlank()) return Float.NaN;
        try {
            return Float.parseFloat(s);
        } catch (NumberFormatException e) {
            return Float.NaN;
        }
    }

    /** float 을 소수 첫째 자리 Double 로(float 오차 105.4 → 105.40000152 를 없앤다) */
    private static Double dbl(float f) {
        return Float.isNaN(f) ? null : Math.round(f * 10.0) / 10.0;
    }
}
