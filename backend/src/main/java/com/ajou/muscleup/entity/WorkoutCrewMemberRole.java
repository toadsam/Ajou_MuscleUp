package com.ajou.muscleup.entity;

/**
 * 짐(모임) 안 역할. OWNER 는 짐마다 한 명(= WorkoutCrew.owner), STAFF 는 운영진 · 트레이너.
 * 예전 값 LEADER 는 db/migration V2 에서 OWNER 로 바뀌었다.
 */
public enum WorkoutCrewMemberRole {
    OWNER,
    STAFF,
    MEMBER
}
