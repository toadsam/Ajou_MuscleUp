package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.ai.*;
import com.ajou.muscleup.entity.AiMessageType;
import com.ajou.muscleup.service.AiChatHistoryService;
import com.ajou.muscleup.service.AiService;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
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
            @RequestParam(value = "goalIntensity", required = false, defaultValue = "standard") String goalIntensity
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
                goalIntensity
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
                req.getGoalIntensity()
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
            writer.title("InBody AI Coaching Report");
            writer.line("Created: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
            writer.line("Member: " + nz(req.getMemberName()));
            writer.line("Goal Source: " + nz(req.getGoalSource()));
            writer.line("Confidence: " + (req.getConfidence() == null ? "-" : req.getConfidence() + "%"));
            writer.blank();

            writer.section("Extracted Metrics");
            writer.mapRows(req.getMetrics());
            writer.section("Targets");
            writer.mapRows(req.getTargets());
            writer.section("Daily Nutrition");
            writer.mapRows(req.getDailyNutrition());

            writer.section("Weekly Checkpoints");
            if (req.getWeeklyCheckpoints() == null || req.getWeeklyCheckpoints().isEmpty()) {
                writer.line("- No checkpoint data");
            } else {
                for (Map<String, String> row : req.getWeeklyCheckpoints()) {
                    writer.line("- Week " + nz(row.get("week"))
                            + " | Weight " + nz(row.get("target_weight_kg"))
                            + " | BodyFat " + nz(row.get("target_body_fat_kg"))
                            + " | Focus " + nz(row.get("focus")));
                }
            }

            if (req.getWarnings() != null && !req.getWarnings().isEmpty()) {
                writer.section("Warnings");
                for (String warning : req.getWarnings()) {
                    writer.line("- " + warning);
                }
            }

            writer.section("Consultation");
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
        private final PDType1Font base = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        private final PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

        private PdfWriter(PDDocument document) throws Exception {
            this.document = document;
            newPage();
        }

        private void newPage() throws Exception {
            if (stream != null) stream.close();
            page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            y = page.getMediaBox().getHeight() - margin;
        }

        private void title(String text) throws Exception { write(text, bold, 16f); }
        private void section(String text) throws Exception { blank(); write(text, bold, 12f); }
        private void line(String text) throws Exception { write(text, base, 10f); }
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

        private void write(String text, PDType1Font font, float size) throws Exception {
            float maxWidth = page.getMediaBox().getWidth() - (margin * 2);
            for (String row : wrap(text, font, size, maxWidth)) {
                if (y < margin) newPage();
                stream.beginText();
                stream.setFont(font, size);
                stream.newLineAtOffset(margin, y);
                stream.showText(row == null ? "" : row);
                stream.endText();
                y -= lineHeight;
            }
        }

        private List<String> wrap(String text, PDType1Font font, float size, float maxWidth) throws Exception {
            if (text == null || text.isBlank()) return List.of("");
            List<String> rows = new ArrayList<>();
            String[] words = text.split(" ");
            StringBuilder line = new StringBuilder();
            for (String word : words) {
                String candidate = line.length() == 0 ? word : line + " " + word;
                float width = font.getStringWidth(candidate) / 1000 * size;
                if (width <= maxWidth) {
                    line = new StringBuilder(candidate);
                } else {
                    rows.add(line.toString());
                    line = new StringBuilder(word);
                }
            }
            if (line.length() > 0) rows.add(line.toString());
            return rows;
        }

        private void close() throws Exception {
            if (stream != null) stream.close();
        }
    }
}
