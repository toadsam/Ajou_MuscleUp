package com.ajou.muscleup.entity;

public enum BragVisibility {
    PUBLIC,
    FRIENDS,
    /** 그 짐(모임) 멤버만. BragPost.gym 이 있어야 한다(db 제약은 V4 에서 푼다) */
    GYM
}
