package com.ajou.muscleup.dto.shadow;

import java.time.LocalDate;
import java.util.List;

/**
 * 그림자에게 한 공격 한 번(운동 · 러닝 저장 응답의 shadow 칸, 상태의 hits 목록).
 * hitOn: 공격한 날(KST), hp: 이번 주 그림자 체력(바의 전체 길이), raw: 환산한 힘, damage: 실제 들어간 힘(하루 상한 · 치명타 뒤), hpBefore/hpAfter: 공격 전후 남은 체력,
 * killed: 이 공격으로 처치했는지(처치 연출은 이때만), overkillPct: 처치 뒤 더 들어간 비율, reward: 처치 보상(한 주 한 번, 아니면 null).
 */
public record ShadowHitResponse(Long id, String source, LocalDate hitOn, int hp, int raw, int damage, boolean crit, int hpBefore, int hpAfter,
                                boolean killed, int overkillPct, Reward reward) {

    /** titles: 이 처치로 새로 얻은 칭호 이름들 */
    public record Reward(int points, int box, List<String> titles) {}
}
