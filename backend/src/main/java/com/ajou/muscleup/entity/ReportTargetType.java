package com.ajou.muscleup.entity;

/** 신고 대상 종류 */
public enum ReportTargetType {
    BRAG_POST,
    BRAG_COMMENT,
    PROTEIN,
    USER,
    /** 홈 헬스장 방명록 한 줄. DB 제약은 V7 이전 SQL 로 풀었다 */
    GYM_GUESTBOOK
}
