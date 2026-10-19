package com.ajou.muscleup.dto.shadow;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 그림자에게 한 공격 한 번(던전 strike 응답, 상태의 hits 목록).
 * hitOn: 공격한 날(KST), hp: 이번 주 그림자 체력(바의 전체 길이), raw: 통에서 쓴 힘, damage: 실제 들어간 힘(보너스 · 치명타 뒤), hpBefore/hpAfter: 공격 전후 남은 체력,
 * killed: 이 공격으로 처치했는지(처치 연출은 이때만), overkillPct: 처치 뒤 더 들어간 비율, reward: 처치 보상(한 주 한 번, 아니면 null).
 * 2차 던전: skill(기술 · 통), grade(타이밍 등급), bonus(타이밍 + 패시브로 더해진 힘), shares(연출용 타 분배, 합 = damage),
 * chargeLeft · critTokensLeft(이 타 뒤 남은 통 · 토큰 — strike 응답에만, 목록에서는 null).
 * 1차 공격(source SESSION · RUN) · 자동 정산(SETTLE)은 skill · grade 가 null 일 수 있다.
 */
public record ShadowHitResponse(Long id, String source, LocalDate hitOn, int hp, int raw, int damage, boolean crit, int hpBefore, int hpAfter,
                                boolean killed, int overkillPct, Reward reward,
                                String skill, String grade, int bonus, List<Integer> shares,
                                Map<String, Integer> chargeLeft, Integer critTokensLeft) {
    /** titles: 이 처치로 새로 얻은 칭호 이름들 */
    public record Reward(int points, int box, List<String> titles) {}
}
