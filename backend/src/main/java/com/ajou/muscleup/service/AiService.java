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
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI ?占쎈떟???占쏀뙣?占쎌뒿?占쎈떎: " + resp.statusCode());
            }

            JsonNode rootNode = objectMapper.readTree(resp.body());
            String content = rootNode.path("choices").path(0).path("message").path("content").asText("");
            if (content.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI ?占쎈떟 ?占쎌떇???占쎈컮瑜댐옙? ?占쎌뒿?占쎈떎.");
            }
            return sanitizeMarkdown(content);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI ?占쎌텧 占??占쎈쪟媛 諛쒖깮?占쎌뒿?占쎈떎.", e);
        }
    }

    public Map<String, Object> requestInbodyConsultation(
            byte[] imageBytes,
            String mediaType,
            String goal,
            String notes,
            String goalIntensity
    ) {
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
                                    "  \"targets\": {\n" +
                                    "    \"target_weight_kg\": \"\",\n" +
                                    "    \"target_skeletal_muscle_kg\": \"\",\n" +
                                    "    \"target_body_fat_kg\": \"\",\n" +
                                    "    \"target_body_fat_percent\": \"\"\n" +
                                    "  },\n" +
                                    "  \"daily_nutrition\": {\n" +
                                    "    \"calories_kcal\": \"\",\n" +
                                    "    \"carb_g\": \"\",\n" +
                                    "    \"protein_g\": \"\",\n" +
                                    "    \"fat_g\": \"\",\n" +
                                    "    \"carb_ratio_percent\": \"\",\n" +
                                    "    \"protein_ratio_percent\": \"\",\n" +
                                    "    \"fat_ratio_percent\": \"\"\n" +
                                    "  },\n" +
                                    "  \"weekly_checkpoints\": [\n" +
                                    "    {\n" +
                                    "      \"week\": \"1\",\n" +
                                    "      \"target_weight_kg\": \"\",\n" +
                                    "      \"target_body_fat_kg\": \"\",\n" +
                                    "      \"focus\": \"\"\n" +
                                    "    }\n" +
                                    "  ],\n" +
                                    "  \"confidence\": 0,\n" +
                                    "  \"warnings\": [\"\"],\n" +
                                    "  \"consultation\": \"\"\n" +
                                    "}\n" +
                                    "Rules:\n" +
                                    "- Use empty string when a metric cannot be found.\n" +
                                    "- Populate targets and daily_nutrition with concrete numbers as much as possible.\n" +
                                    "- weekly_checkpoints should contain at least 4 items (week 1~4).\n" +
                                    "- If user goal is '-', infer a reasonable default goal from InBody values and clearly explain why.\n" +
                                    "- In that case, set targets as AI-recommended values rather than leaving them blank.\n" +
                                    "- confidence is integer 0-100.\n" +
                                    "- consultation must be highly detailed and practical for real use.\n" +
                                    "- consultation must be written in Korean and include these explicit sections:\n" +
                                    "  1) current status summary (weight/body-fat/skeletal-muscle/metabolism)\n" +
                                    "  2) goal setting (4-week short-term + 12-week mid-term)\n" +
                                    "  3) daily calories and macro ratio plan (g and %)\n" +
                                    "  4) meal guide (meal examples, snack guidance, dining-out tips)\n" +
                                    "  5) exercise plan (weekly frequency, split, set/rep, cardio intensity/time, progression)\n" +
                                    "  6) recovery and stress/sleep checklist\n" +
                                    "  7) weekly checkpoint metrics and what to verify\n" +
                                    "  8) risk signals and cautions\n" +
                                    "- each section must contain at least 2 concrete sentences.\n" +
                                    "- consultation should include concrete numbers whenever possible.\n" +
                                    "- consultation length target: at least 1,200 Korean characters.\n" +
                                    "- Mention this is not medical diagnosis.\n" +
                                    "- Goal intensity (conservative/standard/aggressive): " + nz(goalIntensity) + "\n" +
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
            root.set("response_format", buildInbodyJsonSchemaFormat());

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

    public Map<String, Object> requestInbodyConsultationFromMetrics(
            Map<String, String> metrics,
            String goal,
            String notes,
            String goalIntensity
    ) {
        String key = resolveApiKey();
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("model", textModel);
            root.put("temperature", 0.2);

            ArrayNode messages = objectMapper.createArrayNode();
            messages.add(objectMapper.createObjectNode()
                    .put("role", "system")
                    .put("content",
                            "You are a fitness coach that builds detailed inbody consultation JSON only. " +
                                    "Never diagnose medically."));

            String metricJson = objectMapper.writeValueAsString(metrics == null ? Map.of() : metrics);
            String prompt = "Build inbody coaching from confirmed metrics.\n" +
                    "Use this metrics JSON exactly as trusted user-confirmed values: " + metricJson + "\n" +
                    "If some fields are missing, infer cautiously and add warnings.\n" +
                    "Consultation requirements:\n" +
                    "- Write consultation in Korean.\n" +
                    "- Include these sections explicitly: current status, goal setting, nutrition, exercise, checkpoint, caution.\n" +
                    "- For each section, write at least 2 concrete sentences.\n" +
                    "- Include concrete numbers whenever possible.\n" +
                    "- consultation length target: at least 1,200 Korean characters.\n" +
                    "- Mention this is not medical diagnosis.\n" +
                    "Goal intensity: " + nz(goalIntensity) + "\n" +
                    "User goal: " + nz(goal) + "\n" +
                    "User notes: " + nz(notes) + "\n" +
                    "Return only valid JSON with the same schema as requested.";
            messages.add(objectMapper.createObjectNode()
                    .put("role", "user")
                    .put("content", prompt));
            root.set("messages", messages);
            root.set("response_format", buildInbodyJsonSchemaFormat());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(openAiBase + "/v1/chat/completions"))
                    .header("Authorization", "Bearer " + key)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(root.toString(), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> resp = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (resp.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI confirmed-metric analysis failed: " + resp.statusCode());
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
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "InBody confirmed-metric processing failed.", e);
        }
    }

    private String resolveApiKey() {
        String key = (openAiKeyProp != null && !openAiKeyProp.isBlank()) ? openAiKeyProp : System.getenv("OPENAI_API_KEY");
        if (key == null || key.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "OPENAI_API_KEY媛 ?占쎌젙?占쏙옙? ?占쎌븯?占쎈땲??");
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

        Map<String, String> targets = objectNodeToStringMap(node.path("targets"),
                List.of("target_weight_kg", "target_skeletal_muscle_kg", "target_body_fat_kg", "target_body_fat_percent"));
        Map<String, String> dailyNutrition = objectNodeToStringMap(node.path("daily_nutrition"),
                List.of("calories_kcal", "carb_g", "protein_g", "fat_g", "carb_ratio_percent", "protein_ratio_percent", "fat_ratio_percent"));

        List<Map<String, String>> weeklyCheckpoints = new ArrayList<>();
        JsonNode checkpointNode = node.path("weekly_checkpoints");
        if (checkpointNode.isArray()) {
            for (JsonNode item : checkpointNode) {
                Map<String, String> row = new LinkedHashMap<>();
                row.put("week", item.path("week").asText(""));
                row.put("target_weight_kg", item.path("target_weight_kg").asText(""));
                row.put("target_body_fat_kg", item.path("target_body_fat_kg").asText(""));
                row.put("focus", item.path("focus").asText(""));
                weeklyCheckpoints.add(row);
            }
        }

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
            consultation = "遺꾩꽍 寃곌낵瑜?異⑸텇???앹꽦?섏? 紐삵뻽?듬땲?? ?ъ쭊 ?좊챸?꾩? 臾몄꽌 ?뺣㈃ 珥ъ쁺 ?щ?瑜??뺤씤???ㅼ떆 ?쒕룄??二쇱꽭??";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metrics", metrics);
        result.put("targets", targets);
        result.put("dailyNutrition", dailyNutrition);
        result.put("weeklyCheckpoints", weeklyCheckpoints);
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

    private Map<String, String> objectNodeToStringMap(JsonNode node, List<String> keys) {
        Map<String, String> map = new LinkedHashMap<>();
        for (String key : keys) {
            map.put(key, node.path(key).asText(""));
        }
        return map;
    }

    private ObjectNode buildInbodyJsonSchemaFormat() {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("type", "json_schema");
        ObjectNode jsonSchema = root.putObject("json_schema");
        jsonSchema.put("name", "inbody_consult_result");
        jsonSchema.put("strict", true);

        ObjectNode schema = jsonSchema.putObject("schema");
        schema.put("type", "object");

        ObjectNode properties = schema.putObject("properties");
        properties.set("metrics", buildStringMapSchema(List.of(
                "height_cm", "weight_kg", "skeletal_muscle_kg", "body_fat_kg",
                "body_fat_percent", "bmi", "bmr_kcal", "visceral_fat_level", "inbody_score"
        )));
        properties.set("targets", buildStringMapSchema(List.of(
                "target_weight_kg", "target_skeletal_muscle_kg", "target_body_fat_kg", "target_body_fat_percent"
        )));
        properties.set("daily_nutrition", buildStringMapSchema(List.of(
                "calories_kcal", "carb_g", "protein_g", "fat_g",
                "carb_ratio_percent", "protein_ratio_percent", "fat_ratio_percent"
        )));

        ObjectNode checkpointArray = properties.putObject("weekly_checkpoints");
        checkpointArray.put("type", "array");
        ObjectNode checkpointItem = checkpointArray.putObject("items");
        checkpointItem.put("type", "object");
        ObjectNode checkpointProps = checkpointItem.putObject("properties");
        checkpointProps.putObject("week").put("type", "string");
        checkpointProps.putObject("target_weight_kg").put("type", "string");
        checkpointProps.putObject("target_body_fat_kg").put("type", "string");
        checkpointProps.putObject("focus").put("type", "string");
        ArrayNode checkpointRequired = checkpointItem.putArray("required");
        checkpointRequired.add("week");
        checkpointRequired.add("target_weight_kg");
        checkpointRequired.add("target_body_fat_kg");
        checkpointRequired.add("focus");
        checkpointItem.put("additionalProperties", false);

        properties.putObject("confidence").put("type", "integer");
        ObjectNode warnings = properties.putObject("warnings");
        warnings.put("type", "array");
        warnings.putObject("items").put("type", "string");
        properties.putObject("consultation").put("type", "string");

        ArrayNode required = schema.putArray("required");
        required.add("metrics");
        required.add("targets");
        required.add("daily_nutrition");
        required.add("weekly_checkpoints");
        required.add("confidence");
        required.add("warnings");
        required.add("consultation");
        schema.put("additionalProperties", false);
        return root;
    }

    private ObjectNode buildStringMapSchema(List<String> keys) {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode props = schema.putObject("properties");
        ArrayNode required = schema.putArray("required");
        for (String key : keys) {
            props.putObject(key).put("type", "string");
            required.add(key);
        }
        schema.put("additionalProperties", false);
        return schema;
    }
}

