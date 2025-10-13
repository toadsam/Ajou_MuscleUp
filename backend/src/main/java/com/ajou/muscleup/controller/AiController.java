package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.ai.AiAnalyzeRequest;
import com.ajou.muscleup.dto.ai.AiAnalyzeResponse;
import com.ajou.muscleup.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/analyze")
    public ResponseEntity<AiAnalyzeResponse> analyze(@RequestBody AiAnalyzeRequest req) {
        String prompt = buildPrompt(req);
        String content = aiService.analyze(prompt);
        return ResponseEntity.ok(new AiAnalyzeResponse(content));
    }

    private String buildPrompt(AiAnalyzeRequest r) {
        StringBuilder sb = new StringBuilder();
        sb.append("사용자 체성분 입력을 바탕으로 맞춤형 운동/영양 가이드를 작성해 주세요.\n");
        sb.append("- 키(cm): ").append(nz(r.getHeight())).append('\n');
        sb.append("- 몸무게(kg): ").append(nz(r.getWeight())).append('\n');
        sb.append("- 체지방률(%): ").append(nz(r.getBodyFat())).append('\n');
        sb.append("- 골격근량(kg): ").append(nz(r.getMuscleMass())).append('\n');
        if (r.getGoal() != null && !r.getGoal().isBlank()) {
            sb.append("- 목표/요청사항: ").append(r.getGoal()).append('\n');
        }
        sb.append("요구사항:\n");
        sb.append("1) 현재 상태 분석(BMI 등 수치 해석).\n");
        sb.append("2) 주간 운동 계획(빈도, 세트/반복, 휴식, 유산소/무산소 비율).\n");
        sb.append("3) 식단 가이드(단백질, 탄수화물, 지방 권장량과 예시).\n");
        sb.append("4) 부상 예방 및 주의사항.\n");
        sb.append("5) 핵심 요약과 실행 체크리스트.");
        return sb.toString();
    }

    private static String nz(String v) { return (v == null || v.isBlank()) ? "-" : v; }
}

