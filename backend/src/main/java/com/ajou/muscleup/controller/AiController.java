package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.ai.AiAnalyzeRequest;
import com.ajou.muscleup.dto.ai.AiAnalyzeResponse;
import com.ajou.muscleup.dto.ai.AiPlanRequest;
import com.ajou.muscleup.dto.ai.AiPlanResponse;
import com.ajou.muscleup.dto.ai.AiChatRequest;
import com.ajou.muscleup.dto.ai.AiChatResponse;
import com.ajou.muscleup.dto.ai.AiChatLogItem;
import com.ajou.muscleup.dto.ai.AiShareResponse;
import com.ajou.muscleup.dto.ai.AiInbodyConsultResponse;
import com.ajou.muscleup.entity.AiMessageType;
import com.ajou.muscleup.service.AiService;
import com.ajou.muscleup.service.AiChatHistoryService;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final AiChatHistoryService aiChatHistoryService;

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalyzeResponse> analyze(@AuthenticationPrincipal String email, @RequestBody AiAnalyzeRequest req) {
        String userEmail = requireEmail(email);
        String prompt = buildAnalysisPrompt(req);
        String content = aiService.requestCompletion(systemPromptForCoach(), prompt);
        aiChatHistoryService.save(userEmail, AiMessageType.ANALYZE, prompt, content);
        return ResponseEntity.ok(new AiAnalyzeResponse(content));
    }

    @PostMapping("/plan")
    public ResponseEntity<AiPlanResponse> buildPlan(@AuthenticationPrincipal String email, @RequestBody AiPlanRequest req) {
        String userEmail = requireEmail(email);
        String prompt = buildPlanPrompt(req);
        String content = aiService.requestCompletion(systemPromptForPlanner(), prompt);
        aiChatHistoryService.save(userEmail, AiMessageType.PLAN, prompt, content);
        return ResponseEntity.ok(new AiPlanResponse(content));
    }

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(@AuthenticationPrincipal String email, @RequestBody AiChatRequest req) {
        String userEmail = requireEmail(email);
        String prompt = buildChatPrompt(req);
        String content = aiService.requestCompletion(systemPromptForCoach(), prompt);
        aiChatHistoryService.save(userEmail, AiMessageType.CHAT, req.getQuestion(), content);
        return ResponseEntity.ok(new AiChatResponse(content));
    }

    @PostMapping(value = "/inbody/consult", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AiInbodyConsultResponse> consultInbody(
            @AuthenticationPrincipal String email,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "goal", required = false) String goal,
            @RequestParam(value = "notes", required = false) String notes
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
                notes
        );

        String consultation = String.valueOf(result.getOrDefault("consultation", ""));
        aiChatHistoryService.save(
                userEmail,
                AiMessageType.ANALYZE,
                "InBody upload: " + safeFilename(file.getOriginalFilename()),
                consultation
        );

        @SuppressWarnings("unchecked")
        Map<String, String> metrics = (Map<String, String>) result.getOrDefault("metrics", Map.of());
        @SuppressWarnings("unchecked")
        List<String> warnings = (List<String>) result.getOrDefault("warnings", List.of());
        int confidence = (int) result.getOrDefault("confidence", 0);

        return ResponseEntity.ok(new AiInbodyConsultResponse(
                consultation,
                metrics,
                confidence,
                confidence < 80,
                warnings,
                sourceType
        ));
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

    private String buildAnalysisPrompt(AiAnalyzeRequest r) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음 사용자의 체성 정보를 바탕으로 개인 맞춤 운동·영양 가이드를 작성하세요.\n");
        sb.append("- 키(cm): ").append(nz(r.getHeight())).append('\n');
        sb.append("- 몸무게(kg): ").append(nz(r.getWeight())).append('\n');
        sb.append("- 체지방률(%): ").append(nz(r.getBodyFat())).append('\n');
        sb.append("- 골격근량(kg): ").append(nz(r.getMuscleMass())).append('\n');
        if (r.getGoal() != null && !r.getGoal().isBlank()) {
            sb.append("- 목표/요청사항: ").append(r.getGoal()).append('\n');
        }
        sb.append("\n요구사항:\n");
        sb.append("1) 현재 상태 분석(BMI/체성 지표 요약).\n");
        sb.append("2) 주간 운동 계획(빈도, 세트/반복, 유산소·무산소 비율, 강도).\n");
        sb.append("3) 식단 가이드(권장 영양분, 회복 팁, 피해야 할 것).\n");
        sb.append("4) 부상 예방 및 주의사항.\n");
        sb.append("5) 실행 체크리스트 3가지를 bullet로 제시.");
        return sb.toString();
    }

    private String buildPlanPrompt(AiPlanRequest r) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음 조건을 바탕으로 4주 분량의 맞춤 루틴을 만들어 주세요.\n");
        sb.append("- 운동 경험: ").append(nz(r.getExperienceLevel())).append('\n');
        sb.append("- 주간 가능 횟수: ").append(nz(r.getAvailableDays())).append('\n');
        sb.append("- 집중 부위/목표: ").append(nz(r.getFocusArea())).append('\n');
        sb.append("- 사용 가능한 장비: ").append(nz(r.getEquipment())).append('\n');
        sb.append("- 선호 운동 시간: ").append(nz(r.getPreferredTime())).append('\n');
        sb.append("- 메모: ").append(nz(r.getNotes())).append('\n');
        sb.append("\n요청사항:\n");
        sb.append("1) 주차별 핵심 목표 요약.\n");
        sb.append("2) 주일별/요일별 루틴을 표 형식 없이 텍스트로 제시(운동명, 세트/반복, 세션 시간 등).\n");
        sb.append("3) 회복/영양 팁과 주의사항을 bullet로 추가.");
        return sb.toString();
    }

    private String buildChatPrompt(AiChatRequest r) {
        StringBuilder sb = new StringBuilder();
        if (r.getContext() != null && !r.getContext().isBlank()) {
            sb.append("참고 맥락: ").append(r.getContext()).append("\n\n");
        }
        sb.append("사용자 질문: ").append(r.getQuestion()).append("\n");
        sb.append("친근한 트레이너처럼 간결하고 실행 가능한 조언을 제공하세요.");
        return sb.toString();
    }

    private String systemPromptForCoach() {
        return "당신은 과학적인 근거를 바탕으로 한국어로 조언하는 피트니스 코치입니다. " +
                "초보도 이해하기 쉽게 단계별로 설명하고, 건강과 안전을 최우선으로 안내하세요. " +
                "마크다운 형식(**, __, ###, ``` 등) 없이 평문으로 답변하고, bullet은 '- '만 사용하라.";
    }

    private String systemPromptForPlanner() {
        return "당신은 체계적인 운동 루틴을 설계하는 전문가입니다. " +
                "운동명·세트/반복, 세션 시간 등을 명확하게 정리하고 표 형식 없이 제시하세요. " +
                "마크다운 형식(**, __, ###, ``` 등) 없이 평문으로 답변하고, bullet은 '- '만 사용하라.";
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

    private record ProcessedInbodyFile(byte[] imageBytes, String mediaType) {
    }
}
