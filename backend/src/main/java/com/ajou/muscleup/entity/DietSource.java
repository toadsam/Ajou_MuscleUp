package com.ajou.muscleup.entity;

/**
 * 식단 기록 · 목표가 어디서 왔나.
 * MANUAL 직접 입력, PHOTO 사진 인식(PR B), INBODY 인바디 분석 결과의 하루 영양 목표.
 * (새 값을 넣으면 DB 제약부터 — CLAUDE.md "enum 칸에 새 값")
 */
public enum DietSource {
    MANUAL, PHOTO, INBODY
}
