package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.FoodSource;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.security.RateLimiter;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 포장 바코드 → 제품 이름(식약처 바코드 정보) → 영양값 후보(음식 검색 DB). <b>저장하지 않는다</b> — 화면이 후보를 고르면
 * 기존 음식 추가 창에 채우고, 사용자가 저장한다.
 *
 * 바코드 정보에는 영양값이 없어서, 받은 제품 이름으로 FoodCatalogService.search 를 돌려 같은 이름 · 같은 회사 제품을 먼저 보인다.
 * 같은 바코드에 줄이 여러 개(공장 이전 · 생산 종료 기록)라 생산 중인 줄의 이름을 쓴다.
 * 조회 결과는 서버 메모리에 잠깐 둔다(같은 제품을 여러 사람이 찍어도 한 번만 부르게).
 */
@Service
@RequiredArgsConstructor
public class BarcodeService {
    static final int MAX_MATCHES = 5;
    static final int CACHE_SIZE = 2000;
    static final Duration CACHE_FOUND = Duration.ofDays(7);
    static final Duration CACHE_MISSING = Duration.ofHours(12);

    private final BarcodeProductSource source;
    private final FoodCatalogService catalog;
    private final RateLimiter rateLimiter;
    private final Clock clock;

    /** 한 사람이 하루에 바코드를 몇 번까지(외부 API 한도 · 남용 방지) */
    @Value("${diet.barcode.daily-limit:100}")
    private int dailyLimit;

    /**
     * @param found      바코드 정보에 제품이 있는가
     * @param otherNames 같은 바코드에 적힌 다른 이름(드물게 회사가 바코드를 다시 쓴 경우)
     * @param matches    영양값 후보(첫 번째가 가장 잘 맞음). 비면 이름만 채우고 직접 적는다
     */
    public record BarcodeResult(String barcode, boolean found, String name, String maker, String category,
                                List<String> otherNames, List<FoodCatalogService.FoodView> matches, boolean catalogReady) {}

    private record Cached(List<BarcodeProductSource.Product> rows, Instant until) {}

    /** 접근 순서 LRU — 가득 차면 가장 오래 안 쓴 것부터 */
    private final Map<String, Cached> cache = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
            return size() > CACHE_SIZE;
        }
    };

    public BarcodeResult lookup(User me, String raw) {
        String code = raw == null ? "" : raw.strip();
        // EAN-8 · UPC-A(12) · EAN-13 · GTIN-14 — 숫자만
        if (!code.matches("\\d{8,14}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "바코드 숫자(8~14자리)를 확인해 주세요.");
        }
        if (!source.enabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "바코드 조회를 지금 쓸 수 없어요. 음식 이름으로 찾아 주세요.");
        }
        LocalDate today = LocalDate.now(clock);
        rateLimiter.check("diet-barcode:" + me.getId() + ":" + today, dailyLimit, Duration.ofHours(25),
                "바코드 조회는 하루 " + dailyLimit + "번까지예요. 음식 이름으로 찾아 주세요.");

        List<BarcodeProductSource.Product> rows = rows(code);
        if (rows.isEmpty()) {
            return new BarcodeResult(code, false, null, null, null, List.of(), List.of(), true);
        }
        // 생산 중인 줄 먼저, 그다음 받은 순서
        List<BarcodeProductSource.Product> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparing((BarcodeProductSource.Product p) -> !p.active()));
        BarcodeProductSource.Product main = sorted.get(0);
        String mainKey = FoodCatalogService.normalize(main.name());
        Set<String> seen = new LinkedHashSet<>(List.of(mainKey));
        List<String> others = new ArrayList<>();
        for (BarcodeProductSource.Product p : sorted) {
            if (seen.add(FoodCatalogService.normalize(p.name())) && looksDifferent(mainKey, p.name()) && others.size() < 3) {
                others.add(p.name());
            }
        }

        String maker = cleanMaker(main.maker());
        boolean ready = true;
        List<FoodCatalogService.FoodView> matches = List.of();
        for (String q : queries(main.name())) {
            FoodCatalogService.SearchResult r = catalog.search(q);
            ready &= r.ready();
            matches = rank(r.items(), main.name(), maker);
            if (!matches.isEmpty()) break;
        }
        return new BarcodeResult(code, true, main.name(), maker, main.category(), others, matches, ready);
    }

    // ---- 내부 ----

    private List<BarcodeProductSource.Product> rows(String code) {
        Instant now = clock.instant();
        synchronized (cache) {
            Cached c = cache.get(code);
            if (c != null && c.until().isAfter(now)) return c.rows();
        }
        List<BarcodeProductSource.Product> rows = List.copyOf(source.lookup(code));
        synchronized (cache) {
            cache.put(code, new Cached(rows, now.plus(rows.isEmpty() ? CACHE_MISSING : CACHE_FOUND)));
        }
        return rows;
    }

    /** "신(辛)라면" · "신라면"처럼 한쪽이 다른 쪽을 품으면 같은 이름으로 본다 */
    private static boolean looksDifferent(String mainKey, String name) {
        String k = FoodCatalogService.normalize(name);
        return !(k.contains(mainKey) || mainKey.contains(k));
    }

    /**
     * 음식 검색에 넣을 말: 이름 그대로 → 괄호 · 용량(1000mL, 500ml, 30g …)을 뺀 이름 → 첫 낱말.
     * 검색은 낱말이 모두 들어간 것만 찾으므로 덜 맞는 말로 차례로 넓힌다.
     */
    static List<String> queries(String name) {
        Set<String> out = new LinkedHashSet<>();
        String n = name.strip();
        out.add(n);
        String bare = n.replaceAll("\\([^)]*\\)", " ")
                .replaceAll("(?i)\\d+(\\.\\d+)?\\s*(ml|l|kg|mg|g|개입|개|입|봉|팩|매)(?![a-z])", " ")
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\d+$", " ")
                .replaceAll("\\s+", " ")
                .strip();
        if (!bare.isEmpty()) out.add(bare);
        String first = bare.isEmpty() ? "" : bare.split(" ")[0];
        if (first.length() >= 2) out.add(first);
        out.removeIf(q -> FoodCatalogService.normalize(q).isEmpty());
        return List.copyOf(out);
    }

    /** "(주)농심" · "해태가루비(주) 제 2공장" · "(주)오리온제4청주공장" · "서울우유협동조합 안산공장" → 회사 이름만 */
    public static String cleanMaker(String maker) {
        if (maker == null) return null;
        String m = maker.replaceAll("\\([^)]*\\)|㈜|주식회사|유한회사|유한책임회사", " ")
                .replaceAll("\\s+", " ")
                .strip()
                .replaceAll("\\s*제\\s*\\d+\\s*\\S*공장.*$", "")
                .replaceAll("\\s+\\S+(공장|지점)$", "")
                .strip();
        return m.isEmpty() ? null : m;
    }

    /** 이름이 같음 → 같은 회사 → 제품(가공식품) → 검색 순서 */
    private static List<FoodCatalogService.FoodView> rank(List<FoodCatalogService.FoodView> items, String name, String maker) {
        String key = FoodCatalogService.normalize(name);
        String mk = FoodCatalogService.normalize(maker);
        List<FoodCatalogService.FoodView> list = new ArrayList<>(items);
        // 검색 결과는 이미 순위대로 — 안정 정렬로 그 순서를 지킨다
        list.sort(Comparator
                .comparing((FoodCatalogService.FoodView f) -> !FoodCatalogService.normalize(f.name()).equals(key))
                .thenComparing(f -> !sameMaker(mk, f.maker()))
                .thenComparing(f -> f.source() != FoodSource.PROCESSED));
        return list.size() > MAX_MATCHES ? List.copyOf(list.subList(0, MAX_MATCHES)) : list;
    }

    /** 바코드 쪽 회사 이름에 검색 DB 의 회사 이름이 들어 있는가("농심" ⊂ "농심", "오리온" ⊂ "오리온제4청주공장") */
    private static boolean sameMaker(String barcodeMaker, String catalogMaker) {
        String c = FoodCatalogService.normalize(catalogMaker);
        return !barcodeMaker.isEmpty() && c.length() >= 2 && (barcodeMaker.contains(c) || c.contains(barcodeMaker));
    }
}
