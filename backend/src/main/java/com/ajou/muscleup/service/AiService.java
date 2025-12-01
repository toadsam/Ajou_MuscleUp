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

    public String requestCompletion(String systemPrompt, String userPrompt) {
        String key = resolveApiKey();
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", "gpt-4o-mini");

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
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 응답이 실패했습니다: " + resp.statusCode());
            }

            JsonNode rootNode = objectMapper.readTree(resp.body());
            String content = rootNode.path("choices").path(0).path("message").path("content").asText("");
            if (content.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 응답 형식이 올바르지 않습니다.");
            }
            return content.trim();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 호출 중 오류가 발생했습니다.", e);
        }
    }

    private String resolveApiKey() {
        String key = (openAiKeyProp != null && !openAiKeyProp.isBlank()) ? openAiKeyProp : System.getenv("OPENAI_API_KEY");
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "OPENAI_API_KEY가 설정되지 않았습니다.");
        }
        return key;
    }
}
