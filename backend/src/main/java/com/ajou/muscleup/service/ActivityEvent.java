package com.ajou.muscleup.service;

import java.time.LocalDate;

/**
 * "오늘 할 일"에 걸리는 행동(출석 · 식단 · 다른 사람 응원)이 저장됐다는 알림. 같은 트랜잭션 안에서 DailyQuestService 가 받는다
 * (출석 · 식단 · 자랑방 쪽 코드가 할 일 규칙을 몰라도 되게).
 */
public record ActivityEvent(Long userId, Kind kind, LocalDate date) {
    public enum Kind { ATTENDANCE, MEAL, CHEER }
}
