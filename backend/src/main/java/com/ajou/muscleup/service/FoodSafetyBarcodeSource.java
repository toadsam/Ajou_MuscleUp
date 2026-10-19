package com.ajou.muscleup.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 식약처 식품안전나라 Open API "바코드연계제품정보"(서비스 C005, 약 26만 줄). 영양 정보는 없고 이름 · 회사 · 유형만 —
 * 영양값은 BarcodeService 가 음식 검색 DB(FoodCatalogService)에서 이름으로 찾는다.
 *
 * 키는 FOODSAFETY_API_KEY(Railway 변수 · 로컬은 application-local.properties). 키가 주소 경로에 들어가므로
 * 화면에서 부르지 않고 서버에서만 부르며, 주소 · 응답을 로그에 남기지 않는다(오류 코드만).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FoodSafetyBarcodeSource implements BarcodeProductSource {
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Value("${FOODSAFETY_API_KEY:}")
    private String apiKey;

    @Value("${foodsafety.api.base:https://openapi.foodsafetykorea.go.kr/api}")
    private String base;

    @Override
    public boolean enabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public List<Product> lookup(String barcode) {
        if (!enabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "바코드 조회를 지금 쓸 수 없어요. 음식 이름으로 찾아 주세요.");
        }
        // 바코드는 BarcodeService 가 숫자만 넘긴다
        URI uri = URI.create(base + "/" + apiKey.strip() + "/C005/json/1/20/BAR_CD=" + barcode);
        try {
            HttpResponse<String> resp = http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() >= 300) {
                log.warn("바코드 조회 실패: 식품안전나라 HTTP {}", resp.statusCode());
                throw unavailable();
            }
            JsonNode body = objectMapper.readTree(resp.body()).path("C005");
            String code = body.path("RESULT").path("CODE").asText("");
            if ("INFO-200".equals(code)) return List.of(); // 해당하는 데이터가 없습니다
            if (!"INFO-000".equals(code)) {
                // 예: INFO-300 키 오류, INFO-400 권한 없음 — 코드만 남긴다(메시지에 키가 섞일 수 있어 남기지 않음)
                log.warn("바코드 조회 실패: 식품안전나라 {}", code);
                throw unavailable();
            }
            List<Product> out = new ArrayList<>();
            for (JsonNode r : body.path("row")) {
                String name = r.path("PRDLST_NM").asText("").strip();
                if (name.isEmpty()) continue;
                boolean active = r.path("END_DT").asText("").isBlank() && r.path("CLSBIZ_DT").asText("").isBlank();
                out.add(new Product(name, r.path("BSSH_NM").asText("").strip(), r.path("PRDLST_DCNM").asText("").strip(), active));
            }
            return out;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } catch (Exception e) {
            // 예외 메시지에 주소(키)가 들어갈 수 있어 종류만
            log.warn("바코드 조회 실패: {}", e.getClass().getSimpleName());
            throw unavailable();
        }
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "바코드를 조회하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
    }
}
