package com.ajou.muscleup.dto.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class AiChatRequest {
    @NotBlank
    @Size(max = 2000)
    private String question;
    /** 화면이 대화 기록을 통째로 보내므로 넉넉히 받되, 프롬프트에는 뒤쪽 일부만 넣는다(AiController). */
    @Size(max = 20000)
    private String context;
}
