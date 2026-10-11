package com.ajou.muscleup.entity;

/** 공동구매 모집 범위. GYM: 그 짐 멤버만 보고 참여 · PUBLIC: 모든 사용자(여는 사람 조건 있음, docs/design/stage0-gyms.md §2-1) */
public enum GroupBuyVisibility {
    GYM,
    PUBLIC
}
