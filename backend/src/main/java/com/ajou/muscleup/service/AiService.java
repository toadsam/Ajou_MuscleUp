package com.ajou.muscleup.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiService {

    private final ObjectMapper objectMapper;

    @Autowired
    public AiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Value("${openai.api.key:}")
    private String openAiKeyProp;

    @Value("${openai.api.base:https://api.openai.com}")
    private String openAiBase;

    @Value("${openai.model.text:gpt-4o-mini}")
    private String textModel;

    @Value("${openai.model.vision:gpt-4.1-mini}")
    private String visionModel;

    public String requestCompletion(String systemPrompt, String userPrompt) {
        String key = resolveApiKey();
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", textModel);

            ArrayNode messages = objectMapper.createArrayNode();
            messages.add(objectMapper.createObjectNode()
                    .put("role", "system")
                    .put("content", systemPrompt));
            messages.add(objectMapper.createObjectNode()
                    .put("role", "user")
                    .put("content", userPrompt));

            root.set("messages", messages);
            root.put("temperature", 0.4);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(openAiBase + "/v1/chat/completions"))
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(root.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (resp.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI ?�답???�패?�습?�다: " + resp.statusCode());
            }

            JsonNode rootNode = objectMapper.readTree(resp.body());
            String content = rootNode.path("choices").path(0).path("message").path("content").asText("");
            if (content.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI ?�답 ?�식???�바르�? ?�습?�다.");
            }
            return sanitizeMarkdown(content);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI ?�출 �??�류가 발생?�습?�다.", e);
        }
    }

    public Map<String, Object> requestInbodyConsultation(byte[] imageBytes, String mediaType, String goal, String notes) {
        String key = resolveApiKey();
        try {
            String imageBase64 = Base64.getEncoder().encodeToString(imageBytes);

            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", visionModel);
            root.put("temperature", 0.2);

            ArrayNode messages = objectMapper.createArrayNode();
            messages.add(objectMapper.createObjectNode()
                    .put("role", "system")
                    .put("content",
                            "You are an InBody report parser and fitness coach. " +
                                    "Return only valid JSON without markdown. " +
                                    "Never provide medical diagnosis. If uncertain, lower confidence and add warnings."));

            ArrayNode userContent = objectMapper.createArrayNode();
            userContent.add(objectMapper.createObjectNode()
                    .put("type", "text")
                    .put("text",
                            "Extract key InBody values from the uploaded report image and provide coaching in Korean.\n" +
                                    "JSON schema:\n" +
                                    "{\n" +
                                    "  \"metrics\": {\n" +
                                    "    \"height_cm\": \"\",\n" +
                                    "    \"weight_kg\": \"\",\n" +
                                    "    \"skeletal_muscle_kg\": \"\",\n" +
                                    "    \"body_fat_kg\": \"\",\n" +
                                    "    \"body_fat_percent\": \"\",\n" +
                                    "    \"bmi\": \"\",\n" +
                                    "    \"bmr_kcal\": \"\",\n" +
                                    "    \"visceral_fat_level\": \"\",\n" +
                                    "    \"inbody_score\": \"\"\n" +
                                    "  },\n" +
                                    "  \"confidence\": 0,\n" +
                                    "  \"warnings\": [\"\"],\n" +
                                    "  \"consultation\": \"\"\n" +
                                    "}\n" +
                                    "Rules:\n" +
                                    "- Use empty string when a metric cannot be found.\n" +
                                    "- confidence is integer 0-100.\n" +
                                    "- consultation must be highly detailed and practical for real use.\n" +
                                    "- consultation should include all sections below in Korean:\n" +
                                    "  1) 현재 상태 요약(체중/체지방/골격근/대사 관점)\n" +
                                    "  2) 목표 설정(단기 4주, 중기 12주 수치 목표)\n" +
                                    "  3) 하루 섭취 칼로리 및 탄단지(g, %) 제안 근거\n" +
                                    "  4) 식단 가이드(아침/점심/저녁/간식 예시, 외식 대안, 회식 대응)\n" +
                                    "  5) 운동 계획(주간 빈도, 요일 분할, 세트/반복수, 유산소 시간/강도, 진행 원칙)\n" +
                                    "  6) 회복/수면/스트레스 관리 체크리스트\n" +
                                    "  7) 주차별 체크포인트와 측정 항목\n" +
                                    "  8) 위험 신호/주의사항(무리한 감량, 통증, 어지럼 등)\n" +
                                    "- consultation should include concrete numbers whenever possible.\n" +
                                    "- consultation length target: at least 1,200 Korean characters.\n" +
                                    "- Mention this is not medical diagnosis.\n" +
                                    "- User goal: " + nz(goal) + "\n" +
                                    "- User notes: " + nz(notes)));
            userContent.add(objectMapper.createObjectNode()
                    .put("type", "image_url")
                    .set("image_url", objectMapper.createObjectNode()
                            .put("url", "data:" + mediaType + ";base64," + imageBase64)));

            messages.add(objectMapper.createObjectNode()
                    .put("role", "user")
                    .set("content", userContent));
            root.set("messages", messages);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(openAiBase + "/v1/chat/completions"))
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(root.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (resp.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI image analysis failed: " + resp.statusCode());
            }

            JsonNode rootNode = objectMapper.readTree(resp.body());
            String content = rootNode.path("choices").path(0).path("message").path("content").asText("");
            if (content.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI response was empty.");
            }

            return parseInbodyJson(content);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "InBody AI processing failed.", e);
        }
    }

    private String resolveApiKey() {
        String key = (openAiKeyProp != null && !openAiKeyProp.isBlank()) ? openAiKeyProp : System.getenv("OPENAI_API_KEY");
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "OPENAI_API_KEY가 ?�정?��? ?�았?�니??");
        }
        return key;
    }

    private String sanitizeMarkdown(String content) {
        String cleaned = content;
        cleaned = cleaned.replace("**", "");
        cleaned = cleaned.replace("__", "");
        cleaned = cleaned.replace("```", "");
        cleaned = cleaned.replaceAll("(?m)^\\s*#+\\s*", "");
        return cleaned.trim();
    }

    private Map<String, Object> parseInbodyJson(String rawContent) throws Exception {
        String normalized = stripCodeFence(rawContent);
        JsonNode node = objectMapper.readTree(normalized);

        JsonNode metricsNode = node.path("metrics");
        Map<String, String> metrics = new LinkedHashMap<>();
        metrics.put("height_cm", metricsNode.path("height_cm").asText(""));
        metrics.put("weight_kg", metricsNode.path("weight_kg").asText(""));
        metrics.put("skeletal_muscle_kg", metricsNode.path("skeletal_muscle_kg").asText(""));
        metrics.put("body_fat_kg", metricsNode.path("body_fat_kg").asText(""));
        metrics.put("body_fat_percent", metricsNode.path("body_fat_percent").asText(""));
        metrics.put("bmi", metricsNode.path("bmi").asText(""));
        metrics.put("bmr_kcal", metricsNode.path("bmr_kcal").asText(""));
        metrics.put("visceral_fat_level", metricsNode.path("visceral_fat_level").asText(""));
        metrics.put("inbody_score", metricsNode.path("inbody_score").asText(""));

        int confidence = Math.max(0, Math.min(100, node.path("confidence").asInt(0)));

        List<String> warnings = new ArrayList<>();
        JsonNode warningsNode = node.path("warnings");
        if (warningsNode.isArray()) {
            for (JsonNode warning : warningsNode) {
                String text = warning.asText("").trim();
                if (!text.isEmpty()) {
                    warnings.add(text);
                }
            }
        }

        String consultation = sanitizeMarkdown(node.path("consultation").asText(""));
        if (consultation.isBlank()) {
            consultation = "분석 결과를 충분히 생성하지 못했습니다. 사진 선명도와 문서 정면 촬영 여부를 확인해 다시 시도해 주세요.";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metrics", metrics);
        result.put("confidence", confidence);
        result.put("warnings", warnings);
        result.put("consultation", consultation);
        return result;
    }

    private String stripCodeFence(String rawContent) {
        String trimmed = rawContent == null ? "" : rawContent.trim();
        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceFirst("^```[a-zA-Z]*\\s*", "");
            trimmed = trimmed.replaceFirst("\\s*```$", "");
        }
        return trimmed.trim();
    }

    private static String nz(String value) {
        return (value == null || value.isBlank()) ? "-" : value;
    }
}
