package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.FoodSource;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 음식 검색(식단 기록 PR B).
 *
 * 데이터: resources/food/foods.tsv.gz — 식약처 K-FIND 가공식품 · 음식 DB, 농진청 국가표준식품성분 DB 에서 검색에 필요한 칸만 추린 것
 * (만드는 법: scripts/food/README.md). 칸: src name maker basis kcal protein fat carb serving_g package_g.
 *
 * 서버가 뜬 뒤 별도 스레드에서 표의 줄 수와 파일 줄 수를 비교해, 다르면 food_items 를 한 트랜잭션으로 지우고 다시 넣는다
 * (넣는 동안에는 이전 데이터가 그대로 검색된다). 30만 줄이라 처음 한 번은 몇 분 걸린다. 테스트는 food.catalog.autoload=false.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FoodCatalogService {
    static final String RESOURCE = "food/foods.tsv.gz";
    static final int MAX_RESULTS = 30;
    /** 한 문장에 넣는 줄 수(자리표시자 11 × 500 = 5,500 — Postgres 한도 32,767 안쪽) */
    private static final int BATCH = 500;

    /**
     * 같은 음식을 다르게 부르는 말(검색어 → 데이터 속 이름). 원재료 DB 는 "달걀", "닭고기, 가슴살", "쇠고기"처럼 적혀 있다.
     * 낱말 하나가 이 중 하나면 두 말 모두로 찾는다.
     */
    static final Map<String, String> SYNONYMS = Map.of(
            "계란", "달걀", "달걀", "계란",
            "닭가슴살", "닭고기가슴살",
            "소고기", "쇠고기", "쇠고기", "소고기");

    private final JdbcTemplate jdbc;
    private final PlatformTransactionManager transactionManager;

    @Value("${food.catalog.autoload:true}")
    private boolean autoload;

    public record FoodView(Long id, FoodSource source, String name, String maker, String basis,
                           Double kcal, Double proteinG, Double fatG, Double carbG,
                           Double servingG, Double packageG) {}

    public record SearchResult(boolean ready, List<FoodView> items) {}

    /** 이름 · 검색어를 같은 방식으로: 소문자, 글자와 숫자만(띄어쓰기 · 괄호 · 쉼표 · 밑줄 무시) */
    public static String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void loadOnStartup() {
        if (!autoload) return;
        Thread t = new Thread(() -> {
            try {
                ClassPathResource res = new ClassPathResource(RESOURCE);
                if (!res.exists()) {
                    log.warn("음식 검색 데이터 파일이 없습니다: {}", RESOURCE);
                    return;
                }
                loadIfChanged(res::getInputStream);
            } catch (Exception e) {
                log.error("음식 검색 데이터를 넣지 못했습니다", e);
            }
        }, "food-catalog-loader");
        t.setDaemon(true);
        t.start();
    }

    /** 파일 줄 수가 표와 다를 때만 다시 넣는다. 넣은 줄 수(건너뛰면 -1)를 돌려준다 */
    public int loadIfChanged(IOSupplier source) throws IOException {
        int lines = countRows(source.get());
        Integer have = jdbc.queryForObject("select count(*) from food_items", Integer.class);
        if (have != null && have == lines) {
            log.info("음식 검색 데이터: 이미 {}건 — 그대로 둡니다", have);
            return -1;
        }
        long started = System.currentTimeMillis();
        Integer inserted = new TransactionTemplate(transactionManager).execute(status -> {
            jdbc.update("delete from food_items");
            try {
                return insertAll(source.get());
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
        });
        log.info("음식 검색 데이터 {}건을 넣었습니다({}초)", inserted, (System.currentTimeMillis() - started) / 1000);
        return inserted == null ? 0 : inserted;
    }

    public interface IOSupplier {
        InputStream get() throws IOException;
    }

    public SearchResult search(String q) {
        List<String> tokens = new ArrayList<>();
        for (String part : (q == null ? "" : q).trim().split("\\s+")) {
            String t = normalize(part);
            if (!t.isEmpty()) tokens.add(t);
            if (tokens.size() == 4) break;
        }
        // 처음 넣는 몇 분 동안은 비어 있다 → 화면이 "준비 중"을 보여 준다
        boolean ready = !jdbc.queryForList("select id from food_items where id > 0 order by id limit 1").isEmpty();
        if (tokens.isEmpty()) return new SearchResult(ready, List.of());

        StringBuilder sql = new StringBuilder("select id, source, name, maker, basis, kcal, protein_g, fat_g, carb_g, serving_g, package_g "
                + "from food_items where ");
        List<Object> args = new ArrayList<>();
        for (int i = 0; i < tokens.size(); i++) {
            if (i > 0) sql.append(" and ");
            String t = tokens.get(i);
            String alt = SYNONYMS.get(t);
            sql.append(alt == null ? "search_key like ?" : "(search_key like ? or search_key like ?)");
            args.add("%" + t + "%");
            if (alt != null) args.add("%" + alt + "%");
        }
        // 짧은 이름이 대체로 원하는 것(닭가슴살 → "닭가슴살, 생것" 이 "닭가슴살 스테이크 소스맛"보다 먼저)
        sql.append(" order by length(name) limit 300");
        List<FoodView> rows = jdbc.query(sql.toString(), (rs, i) -> new FoodView(
                rs.getLong("id"), FoodSource.valueOf(rs.getString("source")), rs.getString("name"), rs.getString("maker"),
                rs.getString("basis"), num(rs.getObject("kcal")), num(rs.getObject("protein_g")), num(rs.getObject("fat_g")),
                num(rs.getObject("carb_g")), num(rs.getObject("serving_g")), num(rs.getObject("package_g"))), args.toArray());

        // 순위는 쓴 말과 비슷한 말로 바꾼 것 중 더 잘 맞는 쪽으로
        List<String> alts = tokens.stream().map(t -> SYNONYMS.getOrDefault(t, t)).toList();
        String whole = String.join("", tokens);
        String first = tokens.get(0);
        String altWhole = String.join("", alts);
        String altFirst = alts.get(0);
        rows = new ArrayList<>(rows);
        rows.sort(Comparator
                .comparingInt((FoodView f) -> Math.min(rankOf(f, whole, first), rankOf(f, altWhole, altFirst)))
                .thenComparingInt(f -> tokens.size() == 1 ? sourceOrder(f.source()) : 0)
                .thenComparingInt(f -> f.name().length()));
        return new SearchResult(ready, rows.size() > MAX_RESULTS ? rows.subList(0, MAX_RESULTS) : rows);
    }

    // ---- 내부 ----

    /** 원재료는 "바나나, 생것"처럼 쉼표 뒤가 상태라 쉼표 앞 이름으로도 비교한다 */
    private static int rankOf(FoodView f, String whole, String first) {
        int r = rank(normalize(f.name()), whole, first);
        int comma = f.name().indexOf(',');
        if (f.source() == FoodSource.RAW && comma > 0) {
            r = Math.min(r, rank(normalize(f.name().substring(0, comma)), whole, first));
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

    private static Double num(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static int countRows(InputStream in) throws IOException {
        int n = 0;
        try (BufferedReader r = reader(in)) {
            r.readLine(); // 머리줄
            String line;
            while ((line = r.readLine()) != null) {
                if (parse(line.split("\t", -1)) != null) n++;
            }
        }
        return n;
    }

    private int insertAll(InputStream in) throws IOException {
        int total = 0;
        List<Object[]> batch = new ArrayList<>(BATCH);
        try (BufferedReader r = reader(in)) {
            r.readLine();
            String line;
            while ((line = r.readLine()) != null) {
                String[] c = line.split("\t", -1);
                FoodSource src = parse(c);
                if (src == null) continue;
                String name = cut(c[1], 200);
                String maker = c[2].isBlank() ? null : cut(c[2], 100);
                String key = cut(normalize(name) + " " + normalize(maker), 320);
                batch.add(new Object[]{src.name(), name, maker, key, c[3], dbl(c[4]), dbl(c[5]), dbl(c[6]), dbl(c[7]),
                        dbl(c[8]), dbl(c[9])});
                if (batch.size() == BATCH) {
                    total += insertRows(batch);
                    batch.clear();
                }
            }
        }
        if (!batch.isEmpty()) total += insertRows(batch);
        return total;
    }

    /**
     * 여러 줄을 insert 한 문장(values (...), (...), ...)으로 넣는다.
     * 운영 접속 주소에 대량 넣기 옵션(rewriteBatchedStatements 등)이 없어도 MySQL · Postgres 모두 빠르다.
     */
    private int insertRows(List<Object[]> rows) {
        StringBuilder sql = new StringBuilder("insert into food_items (source, name, maker, search_key, basis, kcal, protein_g, fat_g, carb_g, serving_g, package_g) values ");
        List<Object> args = new ArrayList<>(rows.size() * 11);
        for (int i = 0; i < rows.size(); i++) {
            sql.append(i == 0 ? "" : ",").append("(?,?,?,?,?,?,?,?,?,?,?)");
            args.addAll(Arrays.asList(rows.get(i)));
        }
        jdbc.update(sql.toString(), args.toArray());
        return rows.size();
    }

    /** 넣을 수 있는 줄이면 종류, 아니면 null — 줄 수 비교와 넣기가 같은 기준을 쓴다 */
    private static FoodSource parse(String[] c) {
        if (c.length < 10 || c[1].isBlank()) return null;
        return switch (c[0]) {
            case "P" -> FoodSource.PROCESSED;
            case "D" -> FoodSource.DISH;
            case "R" -> FoodSource.RAW;
            default -> null;
        };
    }

    private static BufferedReader reader(InputStream in) throws IOException {
        return new BufferedReader(new InputStreamReader(new GZIPInputStream(in), StandardCharsets.UTF_8));
    }

    private static Double dbl(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return Double.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String cut(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
