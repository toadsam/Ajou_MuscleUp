package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.ai.*;
import com.ajou.muscleup.entity.AiMessageType;
import com.ajou.muscleup.service.AiChatHistoryService;
import com.ajou.muscleup.service.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
public class AiController {

    private final AiService aiService;
    private final AiChatHistoryService aiChatHistoryService;

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalyzeResponse> analyze(@AuthenticationPrincipal String email, @RequestBody AiAnalyzeRequest req) {
        String userEmail = requireEmail(email);
        String prompt = "신체 정보 분석 요청\n" +
                "- 키(cm): " + nz(req.getHeight()) + "\n" +
                "- 체중(kg): " + nz(req.getWeight()) + "\n" +
                "- 체지방률(%): " + nz(req.getBodyFat()) + "\n" +
                "- 골격근량(kg): " + nz(req.getMuscleMass()) + "\n" +
                "- 목표: " + nz(req.getGoal());
        String content = aiService.requestCompletion(systemPromptForCoach(), prompt);
        aiChatHistoryService.save(userEmail, AiMessageType.ANALYZE, prompt, content);
        return ResponseEntity.ok(new AiAnalyzeResponse(content));
    }

    @PostMapping("/plan")
    public ResponseEntity<AiPlanResponse> buildPlan(@AuthenticationPrincipal String email, @RequestBody AiPlanRequest req) {
        String userEmail = requireEmail(email);
        String prompt = "4주 운동 계획 요청\n" +
                "- 경험: " + nz(req.getExperienceLevel()) + "\n" +
                "- 주간 가능 횟수: " + nz(req.getAvailableDays()) + "\n" +
                "- 목표: " + nz(req.getFocusArea()) + "\n" +
                "- 장비: " + nz(req.getEquipment()) + "\n" +
                "- 시간: " + nz(req.getPreferredTime()) + "\n" +
                "- 메모: " + nz(req.getNotes());
        String content = aiService.requestCompletion(systemPromptForPlanner(), prompt);
        aiChatHistoryService.save(userEmail, AiMessageType.PLAN, prompt, content);
        return ResponseEntity.ok(new AiPlanResponse(content));
    }

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(@AuthenticationPrincipal String email, @RequestBody AiChatRequest req) {
        String userEmail = requireEmail(email);
        String prompt = (req.getContext() == null ? "" : "참고 맥락: " + req.getContext() + "\n\n") +
                "질문: " + req.getQuestion();
        String content = aiService.requestCompletion(systemPromptForCoach(), prompt);
        aiChatHistoryService.save(userEmail, AiMessageType.CHAT, req.getQuestion(), content);
        return ResponseEntity.ok(new AiChatResponse(content));
    }

    @PostMapping(value = "/inbody/consult", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AiInbodyConsultResponse> consultInbody(
            @AuthenticationPrincipal String email,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "goal", required = false) String goal,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "goalIntensity", required = false, defaultValue = "standard") String goalIntensity,
            @RequestParam(value = "gender", required = false) String gender,
            @RequestParam(value = "age", required = false) Integer age,
            @RequestParam(value = "heightCm", required = false) Integer heightCm
    ) {
        String userEmail = requireEmail(email);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일이 필요합니다.");
        }
        if (file.getSize() > 10L * 1024L * 1024L) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 크기는 10MB 이하여야 합니다.");
        }

        String sourceType = detectSourceType(file);
        ProcessedInbodyFile processed = preprocess(file, sourceType);
        Map<String, Object> result = aiService.requestInbodyConsultation(
                processed.imageBytes(),
                processed.mediaType(),
                goal,
                notes,
                goalIntensity,
                gender,
                age,
                heightCm
        );

        String consultation = String.valueOf(result.getOrDefault("consultation", ""));
        aiChatHistoryService.save(
                userEmail,
                AiMessageType.ANALYZE,
                "InBody upload: " + safeFilename(file.getOriginalFilename()),
                consultation
        );

        String goalSource = (goal == null || goal.isBlank()) ? "AUTO" : "USER";
        return ResponseEntity.ok(toInbodyResponse(result, goalSource, sourceType));
    }

    @PostMapping("/inbody/review-consult")
    public ResponseEntity<AiInbodyConsultResponse> reviewConsult(
            @AuthenticationPrincipal String email,
            @RequestBody AiInbodyReviewRequest req
    ) {
        String userEmail = requireEmail(email);
        if (req.getMetrics() == null || req.getMetrics().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "확정 수치가 필요합니다.");
        }

        Map<String, Object> result = aiService.requestInbodyConsultationFromMetrics(
                req.getMetrics(),
                req.getGoal(),
                req.getNotes(),
                req.getGoalIntensity(),
                req.getGender(),
                req.getAge(),
                req.getHeightCm()
        );

        String consultation = String.valueOf(result.getOrDefault("consultation", ""));
        aiChatHistoryService.save(
                userEmail,
                AiMessageType.ANALYZE,
                "InBody confirmed metrics review",
                consultation
        );

        return ResponseEntity.ok(toInbodyResponse(result, "USER_CONFIRMED", "confirmed-metrics"));
    }

    @PostMapping("/inbody/report/pdf")
    public ResponseEntity<byte[]> buildInbodyPdf(
            @AuthenticationPrincipal String email,
            @RequestBody AiInbodyPdfRequest req
    ) {
        requireEmail(email);
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "요청 본문이 필요합니다.");
        }

        try {
            byte[] pdf = renderInbodyPdf(req);
            String fileName = "inbody-report-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm")) + ".pdf";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20"))
                    .body(pdf);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "PDF 생성에 실패했습니다.", e);
        }
    }

    @GetMapping("/chat/history")
    public ResponseEntity<List<AiChatLogItem>> history(
            @AuthenticationPrincipal String email,
            @RequestParam(value = "type", required = false) AiMessageType type,
            @RequestParam(value = "limit", defaultValue = "50") int limit
    ) {
        String userEmail = requireEmail(email);
        return ResponseEntity.ok(aiChatHistoryService.getRecent(userEmail, type, limit));
    }

    @PostMapping("/chat/history/{id}/share")
    public ResponseEntity<AiShareResponse> share(
            @AuthenticationPrincipal String email,
            @PathVariable("id") Long id
    ) {
        String userEmail = requireEmail(email);
        return ResponseEntity.ok(aiChatHistoryService.share(userEmail, id));
    }

    @DeleteMapping("/chat/history/{id}/share")
    public ResponseEntity<Void> unshare(
            @AuthenticationPrincipal String email,
            @PathVariable("id") Long id
    ) {
        String userEmail = requireEmail(email);
        aiChatHistoryService.unshare(userEmail, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/share/{slug}")
    public ResponseEntity<AiShareResponse> viewShared(@PathVariable("slug") String slug) {
        return ResponseEntity.ok(aiChatHistoryService.getSharedBySlug(slug));
    }

    private String systemPromptForCoach() {
        return "당신은 안전하고 실용적인 피트니스 코치입니다. 과장 없이 실행 가능한 조언만 제공합니다.";
    }

    private String systemPromptForPlanner() {
        return "당신은 주차별 운동 루틴을 설계하는 코치입니다. 세트, 반복, 강도를 구체적으로 제시합니다.";
    }

    private String requireEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }
        return email;
    }

    private static String nz(String v) {
        return (v == null || v.isBlank()) ? "-" : v;
    }

    private String detectSourceType(MultipartFile file) {
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if ("application/pdf".equalsIgnoreCase(contentType) || filename.endsWith(".pdf")) {
            return "pdf";
        }
        if (contentType != null && contentType.toLowerCase().startsWith("image/")) {
            return "image";
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미지 또는 PDF 파일만 업로드할 수 있습니다.");
    }

    private ProcessedInbodyFile preprocess(MultipartFile file, String sourceType) {
        try {
            if ("image".equals(sourceType)) {
                String mediaType = file.getContentType();
                if (mediaType == null || mediaType.isBlank()) {
                    mediaType = "image/jpeg";
                }
                return new ProcessedInbodyFile(file.getBytes(), mediaType);
            }

            try (PDDocument document = Loader.loadPDF(file.getBytes())) {
                if (document.getNumberOfPages() == 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF 페이지가 비어 있습니다.");
                }
                PDFRenderer renderer = new PDFRenderer(document);
                var image = renderer.renderImageWithDPI(0, 220, ImageType.RGB);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ImageIO.write(image, "jpg", out);
                return new ProcessedInbodyFile(out.toByteArray(), "image/jpeg");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "파일 처리 중 오류가 발생했습니다.", e);
        }
    }

    private String safeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unknown";
        }
        String compact = filename.replaceAll("[\\r\\n]", " ").trim();
        return compact.length() > 120 ? compact.substring(0, 120) : compact;
    }

    private AiInbodyConsultResponse toInbodyResponse(Map<String, Object> result, String goalSource, String sourceType) {
        @SuppressWarnings("unchecked")
        Map<String, String> metrics = (Map<String, String>) result.getOrDefault("metrics", Map.of());
        @SuppressWarnings("unchecked")
        Map<String, String> targets = (Map<String, String>) result.getOrDefault("targets", Map.of());
        @SuppressWarnings("unchecked")
        Map<String, String> dailyNutrition = (Map<String, String>) result.getOrDefault("dailyNutrition", Map.of());
        @SuppressWarnings("unchecked")
        Map<String, String> structuredReport = (Map<String, String>) result.getOrDefault("structuredReport", Map.of());
        @SuppressWarnings("unchecked")
        List<Map<String, String>> weeklyCheckpoints = (List<Map<String, String>>) result.getOrDefault("weeklyCheckpoints", List.of());
        @SuppressWarnings("unchecked")
        List<String> warnings = (List<String>) result.getOrDefault("warnings", List.of());
        int confidence = (int) result.getOrDefault("confidence", 0);
        String consultation = String.valueOf(result.getOrDefault("consultation", ""));

        return new AiInbodyConsultResponse(
                consultation,
                metrics,
                targets,
                dailyNutrition,
                structuredReport,
                weeklyCheckpoints,
                goalSource,
                confidence,
                confidence < 80,
                warnings,
                sourceType
        );
    }

    private byte[] renderInbodyPdf(AiInbodyPdfRequest req) throws Exception {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(document);
            writer.title("Deukgeun InBody AI Report");
            writer.line("Created: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            writer.line("Member: " + nz(req.getMemberName()));
            writer.line("Goal Source: " + nz(req.getGoalSource()));
            writer.line("Confidence: " + (req.getConfidence() == null ? "-" : req.getConfidence() + "%"));
            writer.blank();
            writer.callout("This report summarizes current status, goals, meal guidance, and workout direction in a beginner-friendly order.");
            writer.callout("Read the gap between current and target values together with the weekly trend, not just one number.");

            writer.section("Key Metrics");
            writer.mapRows(req.getMetrics());
            writer.section("Target Metrics");
            writer.mapRows(req.getTargets());
            writer.section("Daily Nutrition Guide");
            writer.mapRows(req.getDailyNutrition());

            writer.section("Weekly Checkpoints");
            if (req.getWeeklyCheckpoints() == null || req.getWeeklyCheckpoints().isEmpty()) {
                writer.line("- No checkpoint data");
            } else {
                for (Map<String, String> row : req.getWeeklyCheckpoints()) {
                    writer.line("- Week " + nz(row.get("week"))
                            + " | Target Weight " + nz(row.get("target_weight_kg"))
                            + " | Target Body Fat " + nz(row.get("target_body_fat_kg"))
                            + " | Focus " + nz(row.get("focus")));
                }
            }

            if (req.getWarnings() != null && !req.getWarnings().isEmpty()) {
                writer.section("Warnings");
                for (String warning : req.getWarnings()) {
                    writer.line("- " + warning);
                }
            }

            writer.section("Detailed Consultation");
            writer.paragraph(nz(req.getConsultation()));
            writer.close();

            document.save(out);
            return out.toByteArray();
        }
    }

    private record ProcessedInbodyFile(byte[] imageBytes, String mediaType) {}

    private static class PdfWriter {
        private final PDDocument document;
        private PDPage page;
        private PDPageContentStream stream;
        private float y;
        private final float margin = 52f;
        private final float lineHeight = 15f;
        private final PDFont base;
        private final PDFont bold;

        private PdfWriter(PDDocument document) throws Exception {
            this.document = document;
            this.base = loadUnicodeFont(document);
            this.bold = this.base;
            newPage();
        }

        private void newPage() throws Exception {
            if (stream != null) stream.close();
            page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document, page, PDPageContentStream.AppendMode.APPEND, true, true);
            y = page.getMediaBox().getHeight() - margin;
        }

        private void title(String text) throws Exception { write(text, bold, 16f); }
        private void section(String text) throws Exception { blank(); write(text, bold, 12f); }
        private void line(String text) throws Exception { write(text, base, 10f); }
        private void callout(String text) throws Exception {
            blank();
            write("TIP | " + text, bold, 10f);
        }
        private void blank() throws Exception { y -= lineHeight / 2f; if (y < margin) newPage(); }

        private void paragraph(String text) throws Exception {
            for (String row : text.split("\\R")) {
                write(row, base, 10f);
            }
        }

        private void mapRows(Map<String, String> map) throws Exception {
            if (map == null || map.isEmpty()) {
                line("- No data");
                return;
            }
            for (Map.Entry<String, String> e : map.entrySet()) {
                line("- " + e.getKey() + ": " + nz(e.getValue()));
            }
        }

        private void write(String text, PDFont font, float size) throws Exception {
            String safeText = sanitizeForPdf(text, font);
            float maxWidth = page.getMediaBox().getWidth() - (margin * 2);
            for (String row : wrap(safeText, font, size, maxWidth)) {
                if (y < margin) newPage();
                stream.beginText();
                try {
                    stream.setFont(font, size);
                    stream.newLineAtOffset(margin, y);
                    stream.showText(row == null ? "" : row);
                } finally {
                    stream.endText();
                }
                y -= lineHeight;
            }
        }

        private List<String> wrap(String text, PDFont font, float size, float maxWidth) throws Exception {
            if (text == null || text.isBlank()) return List.of("");
            List<String> rows = new ArrayList<>();
            StringBuilder line = new StringBuilder();
            for (int i = 0; i < text.length(); i++) {
                String ch = text.substring(i, i + 1);
                String candidate = line + ch;
                float width = font.getStringWidth(candidate) / 1000 * size;
                if (width <= maxWidth || line.length() == 0) {
                    line.append(ch);
                    continue;
                }
                rows.add(line.toString());
                line = new StringBuilder(ch);
            }
            if (line.length() > 0) rows.add(line.toString());
            return rows;
        }

        private String sanitizeForPdf(String text, PDFont font) {
            if (text == null || text.isBlank()) {
                return "";
            }
            String normalized = text
                    .replace('\u00A0', ' ')
                    .replace('\t', ' ')
                    .replace('\r', '\n')
                    .replaceAll("[\\p{Cntrl}&&[^\r\n]]", "");
            StringBuilder safe = new StringBuilder();
            for (int i = 0; i < normalized.length(); ) {
                int codePoint = normalized.codePointAt(i);
                String ch = new String(Character.toChars(codePoint));
                try {
                    font.encode(ch);
                    safe.append(ch);
                } catch (Exception ignored) {
                    safe.append('?');
                }
                i += Character.charCount(codePoint);
            }
            return safe.toString();
        }

        private PDFont loadUnicodeFont(PDDocument document) throws IOException {
            for (String candidate : List.of(
                    "C:\\Windows\\Fonts\\malgun.ttf",
                    "C:\\Windows\\Fonts\\malgunbd.ttf",
                    "C:\\Windows\\Fonts\\gulim.ttc",
                    "C:\\Windows\\Fonts\\batang.ttc"
            )) {
                Path path = Path.of(candidate);
                if (Files.exists(path)) {
                    try (InputStream inputStream = Files.newInputStream(path)) {
                        return PDType0Font.load(document, inputStream, true);
                    }
                }
            }
            throw new IOException("No usable Unicode font found for PDF rendering.");
        }

        private void close() throws Exception {
            if (stream != null) stream.close();
        }
    }
}
