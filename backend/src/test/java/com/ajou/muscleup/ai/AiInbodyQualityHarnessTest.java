package com.ajou.muscleup.ai;

import com.ajou.muscleup.service.AiService;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

class AiInbodyQualityHarnessTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void generateQualityReportFromSampleCases() throws Exception {
        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            System.out.println("SKIP: OPENAI_API_KEY is not set. InBody quality harness was not executed.");
            return;
        }

        List<SampleCase> sampleCases = loadSampleCases();
        assertFalse(sampleCases.isEmpty(), "sample cases must not be empty");

        AiService aiService = new AiService(objectMapper);

        List<Map<String, Object>> resultRows = new ArrayList<>();
        StringBuilder markdown = new StringBuilder();
        markdown.append("# InBody Quality Report\n\n");
        markdown.append("- Generated: ")
                .append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                .append("\n");
        markdown.append("- Cases: ").append(sampleCases.size()).append("\n\n");

        int totalOverall = 0;
        for (SampleCase sampleCase : sampleCases) {
            Map<String, Object> result = aiService.requestInbodyConsultationFromMetrics(
                    sampleCase.metrics(),
                    sampleCase.context().goal(),
                    sampleCase.context().notes(),
                    sampleCase.context().goalIntensity(),
                    sampleCase.context().gender(),
                    sampleCase.context().age(),
                    sampleCase.context().heightCm()
            );

            EvaluationScore evaluation = evaluate(sampleCase, result);
            totalOverall += evaluation.overallScore();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("caseId", sampleCase.caseId());
            row.put("label", sampleCase.label());
            row.put("overallScore", evaluation.overallScore());
            row.put("dimensionScores", evaluation.dimensionScores());
            row.put("highlights", evaluation.highlights());
            row.put("warnings", result.getOrDefault("warnings", List.of()));
            row.put("structuredReport", result.getOrDefault("structuredReport", Map.of()));
            row.put("consultationPreview", preview(String.valueOf(result.getOrDefault("consultation", "")), 500));
            resultRows.add(row);

            markdown.append("## ").append(sampleCase.label()).append(" (`").append(sampleCase.caseId()).append("`)\n\n");
            markdown.append("- Overall Score: ").append(evaluation.overallScore()).append("/5\n");
            for (Map.Entry<String, Integer> entry : evaluation.dimensionScores().entrySet()) {
                markdown.append("- ").append(entry.getKey()).append(": ").append(entry.getValue()).append("/5\n");
            }
            markdown.append("- Highlights:\n");
            for (String highlight : evaluation.highlights()) {
                markdown.append("  - ").append(highlight).append("\n");
            }
            markdown.append("- Expected Body Type: ").append(sampleCase.expectedDirection().bodyType()).append("\n");
            markdown.append("- Expected Priorities: ").append(String.join(" / ", sampleCase.expectedDirection().priorityOrder())).append("\n");
            markdown.append("- Consultation Preview:\n\n");
            markdown.append("```text\n");
            markdown.append(preview(String.valueOf(result.getOrDefault("consultation", "")), 1200)).append("\n");
            markdown.append("```\n\n");
        }

        int averageScore = sampleCases.isEmpty() ? 0 : Math.round((float) totalOverall / sampleCases.size());
        markdown.insert(markdown.indexOf("\n\n", markdown.indexOf("- Cases:")) + 2, "- Average Overall Score: " + averageScore + "/5\n");

        Path reportDir = Path.of("build", "reports", "inbody-quality");
        Files.createDirectories(reportDir);
        Files.writeString(reportDir.resolve("latest-report.md"), markdown.toString(), StandardCharsets.UTF_8);
        Files.writeString(
                reportDir.resolve("latest-report.json"),
                objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(resultRows),
                StandardCharsets.UTF_8
        );

        System.out.println(markdown);
        System.out.println("Saved report to " + reportDir.toAbsolutePath());
    }

    private List<SampleCase> loadSampleCases() throws IOException {
        return objectMapper.readValue(
                Path.of("src", "test", "resources", "inbody", "sample-cases.json").toFile(),
                new TypeReference<>() {
                }
        );
    }

    private EvaluationScore evaluate(SampleCase sampleCase, Map<String, Object> result) {
        @SuppressWarnings("unchecked")
        Map<String, String> structuredReport = (Map<String, String>) result.getOrDefault("structuredReport", Map.of());
        @SuppressWarnings("unchecked")
        List<Map<String, String>> weeklyCheckpoints = (List<Map<String, String>>) result.getOrDefault("weeklyCheckpoints", List.of());
        String consultation = String.valueOf(result.getOrDefault("consultation", ""));

        Map<String, Integer> scores = new LinkedHashMap<>();
        scores.put("structure", scoreStructure(structuredReport, weeklyCheckpoints, consultation));
        scores.put("diagnosisFit", scoreDiagnosisFit(sampleCase, structuredReport, consultation));
        scores.put("priorityFit", scorePriorityFit(sampleCase, structuredReport, consultation));
        scores.put("detailDepth", scoreDepth(structuredReport, consultation));
        scores.put("safety", scoreSafety(sampleCase, structuredReport, consultation));

        int overall = Math.max(1, Math.min(5,
                Math.round((float) scores.values().stream().mapToInt(Integer::intValue).sum() / scores.size())));

        List<String> highlights = new ArrayList<>();
        highlights.add("구조화 리포트 채움률: " + filledStructuredKeys(structuredReport) + "/" + structuredReport.size());
        highlights.add("주차 체크포인트 수: " + weeklyCheckpoints.size());
        highlights.add("본문 길이: " + consultation.length() + "자");

        if (scores.get("diagnosisFit") <= 3) {
            highlights.add("진단 방향이 기대 케이스와 충분히 맞는지 수동 확인 필요");
        }
        if (scores.get("priorityFit") <= 3) {
            highlights.add("우선순위 표현이 기대 포인트를 충분히 담지 못함");
        }
        if (scores.get("safety") <= 3) {
            highlights.add("불확실성 표기 또는 위험 신호 강도 점검 필요");
        }

        return new EvaluationScore(overall, scores, highlights);
    }

    private int scoreStructure(Map<String, String> structuredReport, List<Map<String, String>> weeklyCheckpoints, String consultation) {
        int filled = filledStructuredKeys(structuredReport);
        int score = 1;
        if (filled >= 6) score++;
        if (filled >= 8) score++;
        if (filled == structuredReport.size()) score++;
        if (weeklyCheckpoints.size() >= 4 && consultation.length() >= 2200) score++;
        return Math.min(5, score);
    }

    private int scoreDiagnosisFit(SampleCase sampleCase, Map<String, String> structuredReport, String consultation) {
        String haystack = normalizeForSearch(
                structuredReport.getOrDefault("diagnosis", "") + " " +
                        structuredReport.getOrDefault("overall", "") + " " +
                        consultation
        );

        int hits = countPhraseHits(haystack, List.of(sampleCase.expectedDirection().bodyType()));
        hits += countPhraseHits(haystack, sampleCase.expectedDirection().mustMention());

        if (hits >= 3) return 5;
        if (hits == 2) return 4;
        if (hits == 1) return 3;
        return 2;
    }

    private int scorePriorityFit(SampleCase sampleCase, Map<String, String> structuredReport, String consultation) {
        String haystack = normalizeForSearch(
                structuredReport.getOrDefault("priority_order", "") + " " +
                        structuredReport.getOrDefault("issues", "") + " " +
                        structuredReport.getOrDefault("exercise_plan", "") + " " +
                        structuredReport.getOrDefault("nutrition_plan", "") + " " +
                        consultation
        );

        int hits = countPhraseHits(haystack, sampleCase.expectedDirection().priorityOrder());
        if (hits >= 3) return 5;
        if (hits == 2) return 4;
        if (hits == 1) return 3;
        return 2;
    }

    private int scoreDepth(Map<String, String> structuredReport, String consultation) {
        int longFields = 0;
        for (String value : structuredReport.values()) {
            if (value != null && value.trim().length() >= 35) {
                longFields++;
            }
        }

        int score = 1;
        if (consultation.length() >= 1800) score++;
        if (consultation.length() >= 2600) score++;
        if (longFields >= 5) score++;
        if (longFields >= 8) score++;
        return Math.min(5, score);
    }

    private int scoreSafety(SampleCase sampleCase, Map<String, String> structuredReport, String consultation) {
        String haystack = normalizeForSearch(
                structuredReport.getOrDefault("risk_signals", "") + " " +
                        structuredReport.getOrDefault("donts", "") + " " +
                        consultation
        );

        boolean sparseCase = sampleCase.caseId().contains("sparse");
        boolean mentionsUncertainty = containsAny(haystack, List.of("불확실", "재확인", "확인필요", "추정", "한계"));
        boolean mentionsRisk = containsAny(haystack, List.of("위험", "주의", "무리", "통증", "피로", "경고"));

        if (sparseCase && mentionsUncertainty) {
            return 5;
        }
        if (mentionsRisk && mentionsUncertainty) {
            return 5;
        }
        if (mentionsRisk) {
            return 4;
        }
        return 3;
    }

    private int filledStructuredKeys(Map<String, String> structuredReport) {
        int filled = 0;
        for (String value : structuredReport.values()) {
            if (value != null && !value.isBlank()) {
                filled++;
            }
        }
        return filled;
    }

    private int countPhraseHits(String haystack, List<String> phrases) {
        int hits = 0;
        for (String phrase : phrases) {
            if (containsAny(haystack, expandKeywords(phrase))) {
                hits++;
            }
        }
        return hits;
    }

    private boolean containsAny(String haystack, List<String> keywords) {
        String normalizedHaystack = normalizeForSearch(haystack);
        for (String keyword : keywords) {
            String normalizedKeyword = normalizeForSearch(keyword);
            if (!normalizedKeyword.isBlank() && normalizedHaystack.contains(normalizedKeyword)) {
                return true;
            }
        }
        return false;
    }

    private List<String> expandKeywords(String phrase) {
        List<String> keywords = new ArrayList<>();
        keywords.add(phrase);
        for (String token : phrase.split("[,()/\\s]+")) {
            if (token.length() >= 2) {
                keywords.add(token);
            }
        }
        return keywords;
    }

    private String normalizeForSearch(String text) {
        return text == null
                ? ""
                : text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{IsAlphabetic}\\p{IsDigit}]+", "");
    }

    private String preview(String text, int limit) {
        if (text == null) return "";
        String compact = text.trim();
        return compact.length() > limit ? compact.substring(0, limit) + "..." : compact;
    }

    private record SampleCase(
            @JsonProperty("case_id")
            String caseId,
            String label,
            SampleContext context,
            Map<String, String> metrics,
            @JsonProperty("expected_direction")
            ExpectedDirection expectedDirection
    ) {
    }

    private record SampleContext(
            String gender,
            Integer age,
            @JsonProperty("height_cm")
            Integer heightCm,
            String goal,
            @JsonProperty("goal_intensity")
            String goalIntensity,
            String notes
    ) {
    }

    private record ExpectedDirection(
            @JsonProperty("body_type")
            String bodyType,
            @JsonProperty("priority_order")
            List<String> priorityOrder,
            @JsonProperty("must_mention")
            List<String> mustMention
    ) {
    }

    private record EvaluationScore(
            int overallScore,
            Map<String, Integer> dimensionScores,
            List<String> highlights
    ) {
    }
}
