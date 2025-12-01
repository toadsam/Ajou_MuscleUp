package com.ajou.muscleup.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AiChatLogItem {
    private String question;
    private String answer;
    private LocalDateTime createdAt;
}
