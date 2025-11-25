package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.ai.AiAnalyzeRequest;
import com.ajou.muscleup.dto.ai.AiAnalyzeResponse;
import com.ajou.muscleup.dto.ai.AiPlanRequest;
import com.ajou.muscleup.dto.ai.AiPlanResponse;
import com.ajou.muscleup.dto.ai.AiChatRequest;
import com.ajou.muscleup.dto.ai.AiChatResponse;
import com.ajou.muscleup.dto.ai.AiChatLogItem;
import com.ajou.muscleup.service.AiService;
import com.ajou.muscleup.service.AiChatHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final AiChatHistoryService aiChatHistoryService;

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalyzeResponse> analyze(@RequestBody AiAnalyzeRequest req) {
        String prompt = buildAnalysisPrompt(req);
        String content = aiService.requestCompletion(systemPromptForCoach(), prompt);
        return ResponseEntity.ok(new AiAnalyzeResponse(content));
    }

    @PostMapping("/plan")
    public ResponseEntity<AiPlanResponse> buildPlan(@RequestBody AiPlanRequest req) {
        String prompt = buildPlanPrompt(req);
        String content = aiService.requestCompletion(systemPromptForPlanner(), prompt);
        return ResponseEntity.ok(new AiPlanResponse(content));
    }

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(@AuthenticationPrincipal String email, @RequestBody AiChatRequest req) {
        String userEmail = requireEmail(email);
        String prompt = buildChatPrompt(req);
        String content = aiService.requestCompletion(systemPromptForCoach(), prompt);
        aiChatHistoryService.save(userEmail, req.getQuestion(), content);
        return ResponseEntity.ok(new AiChatResponse(content));
    }

    @GetMapping("/chat/history")
    public ResponseEntity<List<AiChatLogItem>> history(@AuthenticationPrincipal String email) {
        String userEmail = requireEmail(email);
        return ResponseEntity.ok(aiChatHistoryService.getRecent(userEmail, 50));
    }

    private String buildAnalysisPrompt(AiAnalyzeRequest r) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음 사용자의 체성 정보를 바탕으로 개인 맞춤형 운동 및 영양 가이드를 작성하세요.\n");
        sb.append("- 키(cm): ").append(nz(r.getHeight())).append('\n');
        sb.append("- 몸무게(kg): ").append(nz(r.getWeight())).append('\n');
        sb.append("- 체지방률(%): ").append(nz(r.getBodyFat())).append('\n');
        sb.append("- 골격근량(kg): ").append(nz(r.getMuscleMass())).append('\n');
        if (r.getGoal() != null && !r.getGoal().isBlank()) {
            sb.append("- 목표/요청사항: ").append(r.getGoal()).append('\n');
        }
        sb.append("\n요구사항:\n");
        sb.append("1) 현재 상태 분석(BMI/체성 지표 요약).\n");
        sb.append("2) 주간 운동 계획(빈도, 세트/반복, 유산소/무산소 비율, 난이도).\n");
        sb.append("3) 식단 가이드(권장 영양소, 회복 팁, 지양해야 할 습관).\n");
        sb.append("4) 부상 예방 및 주의사항.\n");
        sb.append("5) 실행 체크리스트 3가지를 bullet로 정리.");
        return sb.toString();
    }

    private String buildPlanPrompt(AiPlanRequest r) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음 조건을 바탕으로 4주 분량의 맞춤형 루틴을 만들어 주세요.\n");
        sb.append("- 운동 경험: ").append(nz(r.getExperienceLevel())).append('\n');
        sb.append("- 주간 가능 일수: ").append(nz(r.getAvailableDays())).append('\n');
        sb.append("- 집중 부위/목표: ").append(nz(r.getFocusArea())).append('\n');
        sb.append("- 사용 가능한 장비: ").append(nz(r.getEquipment())).append('\n');
        sb.append("- 하루 운동 시간: ").append(nz(r.getPreferredTime())).append('\n');
        sb.append("- 메모: ").append(nz(r.getNotes())).append('\n');
        sb.append("\n요청사항:\n");
        sb.append("1) 주차별 핵심 목표 요약.\n");
        sb.append("2) 요일별 세부 루틴을 표 형식으로 제시(운동명, 세트/반복, 휴식, 팁).\n");
        sb.append("3) 회복/영양 팁과 주의사항을 bullet로 추가.");
        return sb.toString();
    }

    private String buildChatPrompt(AiChatRequest r) {
        StringBuilder sb = new StringBuilder();
        if (r.getContext() != null && !r.getContext().isBlank()) {
            sb.append("참고 맥락: ").append(r.getContext()).append("\n\n");
        }
        sb.append("사용자 질문: ").append(r.getQuestion()).append("\n");
        sb.append("친근한 트레이너처럼 간결하고 실행 가능한 답변을 제공하세요.");
        return sb.toString();
    }

    private String systemPromptForCoach() {
        return "당신은 과학적인 근거를 바탕으로 한국어로 조언하는 피트니스 코치입니다. " +
                "초보자도 이해하기 쉽게 단계별로 설명하고, 건강과 안전을 최우선으로 안내하세요.";
    }

    private String systemPromptForPlanner() {
        return "당신은 체계적인 운동 루틴을 설계하는 전문가입니다. " +
                "운동명, 세트/반복, 휴식, 포인트를 명확하게 정리하고 표 형식으로 제시하세요.";
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
}
