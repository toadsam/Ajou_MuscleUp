package com.ajou.muscleup.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@Service
public class AiService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openai.api.key:}")
    private String openAiKeyProp;

    @Value("${openai.api.base:https://api.openai.com}")
    private String openAiBase;

    public String analyze(String prompt) {
        String key = getApiKey();
        try {
            // Build request body
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", "gpt-4o-mini");

            ArrayNode messages = objectMapper.createArrayNode();
            messages.add(objectMapper.createObjectNode()
                    .put("role", "system")
                    .put("content", systemPrompt()));
            messages.add(objectMapper.createObjectNode()
                    .put("role", "user")
                    .put("content", prompt));

            root.set("messages", messages);
            root.put("temperature", 0.4);

            String body = root.toString();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(openAiBase + "/v1/chat/completions"))
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (resp.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 호출 실패: " + resp.statusCode());
            }

            JsonNode rootNode = objectMapper.readTree(resp.body());
            String content = rootNode.path("choices").path(0).path("message").path("content").asText("");
            if (content.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 응답 포맷 오류");
            }
            return content;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 연동 오류", e);
        }
    }

    private String getApiKey() {
        String key = (openAiKeyProp != null && !openAiKeyProp.isBlank())
                ? openAiKeyProp
                : System.getenv("OPENAI_API_KEY");
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "OPENAI_API_KEY 미설정");
        }
        return key;
    }

    private String systemPrompt() {
        return "너는 피트니스 코치 겸 과학 커뮤니케이터야. 초보자도 이해하기 쉽게, 단계별로, 근거(원리/예시)를 들어 상세히 설명해. 숫자는 SI 단위로, 한국어 존대말로 답하고, 위험하거나 의학적 주의가 필요한 경우 명확히 경고해. 마지막에는 실행 체크리스트를 간단히 bullet로 제공해.";
    }
}

