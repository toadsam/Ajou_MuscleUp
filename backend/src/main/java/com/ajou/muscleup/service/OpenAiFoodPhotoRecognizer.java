package com.ajou.muscleup.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 음식 사진을 OpenAI 이미지 모델(openai.model.vision)에 보내 음식 후보를 받는다. 사진은 저장하지 않는다.
 * 응답은 JSON 스키마로 고정(strict). 열쇠는 AiService 와 같은 openai.api.key / OPENAI_API_KEY.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OpenAiFoodPhotoRecognizer implements FoodPhotoRecognizer {
    static final int MAX_ITEMS = 8;

    private final ObjectMapper objectMapper;

    @Value("${openai.api.key:}")
    private String openAiKeyProp;

    @Value("${openai.api.base:https://api.openai.com}")
    private String openAiBase;

    @Value("${openai.model.vision:gpt-4.1-mini}")
    private String visionModel;

    private static final String SYSTEM_PROMPT = """
            You identify foods in a meal photo for a Korean diet log.
            - List each distinct food or drink you can see (max 8). Ignore plates, cutlery, packaging text you cannot read.
            - name: short Korean name as a person would write it (e.g. "닭가슴살 샐러드", "현미밥", "김치찌개", "바나나").
              If a brand is clearly readable on the package, include it (e.g. "하림 닭가슴살").
            - search_name: the most common generic Korean food name to look up in the Korean food composition database
              (e.g. "현미밥", "닭가슴살", "김치찌개", "삶은 달걀", "바나나"). No brand, no adjectives.
            - grams: your best estimate of the edible amount in the photo, in grams (a bowl of rice ≈ 210, one egg ≈ 50).
            - kcal, protein_g, carb_g, fat_g: estimates for that amount.
            - confidence: 0 to 1, how sure you are about the food and the amount.
            - is_food: false when the photo has no food or drink; then items is empty.
            Return only JSON that matches the schema.""";

    @Override
    public Result recognize(byte[] image, String contentType) {
        String key = (openAiKeyProp != null && !openAiKeyProp.isBlank()) ? openAiKeyProp : System.getenv("OPENAI_API_KEY");
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "사진 분석을 지금 쓸 수 없어요.");
        }
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", visionModel);
            root.put("temperature", 0.2);
            ArrayNode messages = root.putArray("messages");
            messages.addObject().put("role", "system").put("content", SYSTEM_PROMPT);
            ObjectNode user = messages.addObject().put("role", "user");
            ArrayNode content = user.putArray("content");
            content.addObject().put("type", "text").put("text", "이 사진 속 음식을 알려 주세요.");
            ObjectNode img = content.addObject().put("type", "image_url");
            img.putObject("image_url")
                    .put("url", "data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(image))
                    // 화면이 긴 변 1280px JPEG 로 줄여 보낸다. auto 면 한 장에 약 1천 토큰(gpt-4.1-mini 기준 1원 안쪽)
                    .put("detail", "auto");
            root.set("response_format", schema());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(openAiBase + "/v1/chat/completions"))
                    .timeout(Duration.ofSeconds(45))
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(root.toString(), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> resp = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
                    .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() >= 300) {
                // 오류 종류만 남긴다(예: insufficient_quota = 크레딧 소진, rate_limit_exceeded = 잠깐 한도). 본문 · 열쇠는 남기지 않는다
                String code = "";
                try {
                    code = objectMapper.readTree(resp.body()).path("error").path("code").asText("");
                } catch (Exception ignored) {
                    // 본문이 JSON 이 아니면 상태 코드만
                }
                log.warn("음식 사진 분석 실패: OpenAI {} {}", resp.statusCode(), code);
                // 크레딧 소진 · 열쇠 문제는 기다려도 안 풀린다 → "지금은 못 쓴다"로 안내
                if (resp.statusCode() == 401 || code.contains("quota") || code.contains("credit") || code.contains("billing")) {
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "사진 분석을 지금 쓸 수 없어요. 음식을 직접 적어 주세요.");
                }
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "사진을 분석하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
            }
            String json = objectMapper.readTree(resp.body()).path("choices").path(0).path("message").path("content").asText("");
            return parse(objectMapper.readTree(json));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "사진을 분석하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
        } catch (Exception e) {
            log.warn("음식 사진 분석 실패", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "사진을 분석하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
        }
    }

    Result parse(JsonNode node) {
        List<Recognized> items = new ArrayList<>();
        for (JsonNode it : node.path("items")) {
            String name = it.path("name").asText("").strip();
            if (name.isEmpty()) continue;
            String search = it.path("search_name").asText("").strip();
            items.add(new Recognized(name, search.isEmpty() ? name : search, it.path("grams").asDouble(0),
                    num(it, "kcal"), num(it, "protein_g"), num(it, "carb_g"), num(it, "fat_g"),
                    Math.max(0, Math.min(1, it.path("confidence").asDouble(0)))));
            if (items.size() == MAX_ITEMS) break;
        }
        return new Result(node.path("is_food").asBoolean(!items.isEmpty()), items);
    }

    private static Double num(JsonNode it, String field) {
        JsonNode v = it.path(field);
        return v.isNumber() ? v.asDouble() : null;
    }

    private ObjectNode schema() {
        ObjectNode format = objectMapper.createObjectNode();
        format.put("type", "json_schema");
        ObjectNode js = format.putObject("json_schema");
        js.put("name", "food_photo");
        js.put("strict", true);
        ObjectNode s = js.putObject("schema");
        s.put("type", "object");
        s.put("additionalProperties", false);
        ObjectNode props = s.putObject("properties");
        props.putObject("is_food").put("type", "boolean");
        ObjectNode items = props.putObject("items");
        items.put("type", "array");
        ObjectNode item = items.putObject("items");
        item.put("type", "object");
        item.put("additionalProperties", false);
        ObjectNode ip = item.putObject("properties");
        ip.putObject("name").put("type", "string");
        ip.putObject("search_name").put("type", "string");
        for (String f : List.of("grams", "kcal", "protein_g", "carb_g", "fat_g", "confidence")) {
            ip.putObject(f).put("type", "number");
        }
        ArrayNode ir = item.putArray("required");
        List.of("name", "search_name", "grams", "kcal", "protein_g", "carb_g", "fat_g", "confidence").forEach(ir::add);
        ArrayNode req = s.putArray("required");
        req.add("is_food");
        req.add("items");
        return format;
    }
}
