package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.shadow.ShadowHistoryItem;
import com.ajou.muscleup.dto.shadow.ShadowHitResponse;
import com.ajou.muscleup.dto.shadow.ShadowStatusResponse;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.RunSession;
import com.ajou.muscleup.entity.ShadowHit;
import com.ajou.muscleup.entity.ShadowWeek;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WeeklyGoalWeek;
import com.ajou.muscleup.entity.WorkoutSession;
import com.ajou.muscleup.entity.WorkoutSet;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.ShadowHitRepository;
import com.ajou.muscleup.repository.ShadowWeekRepository;
import com.ajou.muscleup.repository.WeeklyGoalWeekRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 주간 보스 "그림자"(docs/design/shadow-boss.md). 그림자 = 지난 4주의 나. 이번 주 운동 세션 · 러닝이 공격, 자기 기록 갱신이 치명타.
 * - 한 주 = 월~일(WeeklyGoalService.weekStart, KST Clock). 주 행은 상태를 보거나 처음 공격할 때 만든다(스케줄러 없음).
 * - 휴식 주(WeeklyGoalWeek.rest)는 그림자가 잠든다: 힘은 쌓이되 처치되지 않고, 연속 처치도 끊기지 않는다.
 * - 처치 보상은 한 주 한 번: 캐릭터 점수 +10(applyAttendance), 상자 1개(SHADOW), 칭호(업적 SHADOW_1 · SHADOW_STREAK_4).
 * - 세션 · 러닝을 지우면 그 공격도 지우고 주 합계를 다시 더한다. 이미 처치한 건 되돌리지 않는다(killed_at 유지, 숫자만 줄어듦).
 * - 저장 서비스가 저장 끝에 직접 부른다(응답에 넣어야 하므로). 숫자 규칙은 모두 ShadowRules.
 */
@Service
@RequiredArgsConstructor
public class ShadowBossService {
    static final int MAX_HISTORY_WEEKS = 52;

    private final ShadowWeekRepository weekRepository;
    private final ShadowHitRepository hitRepository;
    private final WeeklyGoalWeekRepository weeklyGoalWeekRepository;
    private final CharacterProfileRepository profileRepository;
    private final CharacterGrowthService characterGrowthService;
    private final CollectionService collectionService;
    private final ExerciseCatalog catalog;
    private final Clock clock;

    /** 이번 주 상태(없으면 이번 주 행을 만든다) */
    @Transactional
    public ShadowStatusResponse status(User user) {
        LocalDate today = LocalDate.now(clock);
        LocalDate ws = WeeklyGoalService.weekStart(today);
        ShadowWeek week = currentWeek(user, ws);
        List<ShadowHitResponse> hits = replay(week, hitRepository.findAllByWeek_IdOrderByIdAsc(week.getId()));
        List<ShadowWeek> recent = weekRepository.findAllByUser_IdAndWeekStartBetween(user.getId(),
                ws.minusWeeks(ShadowRules.STREAK_LOOKBACK_WEEKS), ws);
        ShadowStatusResponse.LastWeek last = recent.stream().filter(w -> w.getWeekStart().equals(ws.minusWeeks(1))).findFirst()
                .map(w -> new ShadowStatusResponse.LastWeek(w.getHp(), w.getDamage(), w.getKilledAt() != null, w.isRest()))
                .orElse(null);
        return new ShadowStatusResponse(ShadowRules.NAME, ws, ws.plusDays(6), week.isRest(), week.getHp(), week.getDamage(),
                ShadowRules.remaining(week.getHp(), week.getDamage()), week.getKilledAt() != null, week.getKilledAt(),
                ShadowRules.overkillPct(week.getHp(), week.getDamage()), week.getLevelAtStart(), hits,
                ShadowRules.streakWeeks(recent, ws), last);
    }

    /** 최근 n 주 전적(이번 주 포함, 최근 순). 행이 없는 주는 빠진다 */
    @Transactional(readOnly = true)
    public List<ShadowHistoryItem> history(User user, int weeks) {
        int n = Math.max(1, Math.min(weeks, MAX_HISTORY_WEEKS));
        LocalDate ws = WeeklyGoalService.weekStart(LocalDate.now(clock));
        return weekRepository.findAllByUser_IdAndWeekStartBetweenOrderByWeekStartDesc(user.getId(), ws.minusWeeks(n - 1), ws).stream()
                .map(w -> new ShadowHistoryItem(w.getWeekStart(), w.getHp(), w.getDamage(), w.getKilledAt() != null, w.isRest()))
                .toList();
    }

    /** 운동 세션을 저장한 뒤(같은 트랜잭션). hasPr: 이 세션에서 개인 최고가 하나라도 나왔는지 → 치명타(세션당 한 번) */
    @Transactional
    public ShadowHitResponse onSession(User user, WorkoutSession session, boolean hasPr) {
        List<String> codes = session.getSets().stream().map(WorkoutSet::getExercise).distinct().toList();
        Map<String, ExerciseCatalog.ExerciseDef> defs = catalog.describe(codes);
        int bodyweightReps = 0;
        for (WorkoutSet set : session.getSets()) {
            ExerciseCatalog.ExerciseDef def = defs.get(set.getExercise());
            if (def != null && def.bodyweight()) {
                bodyweightReps += set.getReps();
            }
        }
        int force = ShadowRules.sessionForce(session.getTotalVolume(), bodyweightReps);
        return attack(user, ShadowHit.SESSION, session.getId(), force, hasPr);
    }

    /** 러닝을 저장한 뒤(같은 트랜잭션). hasRecord: 기록(거리 · 1/5/10km)을 하나라도 깼는지 → 치명타 */
    @Transactional
    public ShadowHitResponse onRun(User user, RunSession run, boolean hasRecord) {
        return attack(user, ShadowHit.RUN, run.getId(), ShadowRules.runForce(run.getDistanceM()), hasRecord);
    }

    /** 세션 · 러닝을 지울 때: 그 공격을 지우고 주 합계를 다시 더한다. 처치 · 보상은 되돌리지 않는다 */
    @Transactional
    public void onDeleted(String source, Long sourceId) {
        List<ShadowHit> hits = hitRepository.findAllBySourceAndSourceId(source, sourceId);
        if (hits.isEmpty()) return;
        Map<Long, ShadowWeek> weeks = new LinkedHashMap<>();
        for (ShadowHit h : hits) {
            weeks.put(h.getWeek().getId(), h.getWeek());
        }
        hitRepository.deleteAll(hits);
        hitRepository.flush();
        for (ShadowWeek week : weeks.values()) {
            recount(week);
        }
    }

    private ShadowHitResponse attack(User user, String source, Long sourceId, int force, boolean record) {
        if (force < ShadowRules.MIN_FORCE) return null;
        LocalDate today = LocalDate.now(clock);
        ShadowWeek week = currentWeek(user, WeeklyGoalService.weekStart(today));

        long alreadyToday = hitRepository.sumRawByWeekAndDay(week.getId(), today);
        int capped = ShadowRules.capped(force, alreadyToday);
        boolean crit = record && capped > 0;
        int damage = ShadowRules.damage(capped, crit, week.getLevelAtStart());

        int before = ShadowRules.remaining(week.getHp(), week.getDamage());
        week.setDamage(week.getDamage() + damage);
        week.setHits(week.getHits() + 1);
        if (crit) week.setCrits(week.getCrits() + 1);
        int after = ShadowRules.remaining(week.getHp(), week.getDamage());

        boolean killedNow = false;
        ShadowHitResponse.Reward reward = null;
        if (week.getKilledAt() == null && !week.isRest() && week.getDamage() >= week.getHp()) {
            week.setKilledAt(LocalDateTime.now(clock));
            killedNow = true;
            if (!week.isRewarded()) {
                week.setRewarded(true);
                reward = reward(user, week);
            }
        }
        weekRepository.save(week);
        ShadowHit hit = hitRepository.save(ShadowHit.builder().week(week).user(user).source(source).sourceId(sourceId).hitOn(today)
                .raw(force).damage(damage).crit(crit).hpAfter(after).build());
        return new ShadowHitResponse(hit.getId(), source, today, week.getHp(), force, damage, crit, before, after, killedNow,
                ShadowRules.overkillPct(week.getHp(), week.getDamage()), reward);
    }

    /** 처치 보상(한 주 한 번): 점수 +10 · 상자 1 · 업적 확인(칭호). 주간 목표 보너스와 같은 길 */
    private ShadowHitResponse.Reward reward(User user, ShadowWeek week) {
        characterGrowthService.applyAttendance(user, ShadowRules.KILL_POINTS);
        for (int i = 0; i < ShadowRules.KILL_BOXES; i++) {
            collectionService.grantBox(user, ShadowRules.BOX_SOURCE);
        }
        // 업적 계산이 이번 처치를 보도록 먼저 쓴다
        weekRepository.saveAndFlush(week);
        List<String> titles = collectionService.unlockAchievements(user);
        return new ShadowHitResponse.Reward(ShadowRules.KILL_POINTS, ShadowRules.KILL_BOXES, titles);
    }

    /** 이번 주 행(없으면 만든다). 휴식 여부는 주간 목표의 휴식 주를 그때그때 따라간다(처치한 뒤에는 고정) */
    private ShadowWeek currentWeek(User user, LocalDate ws) {
        boolean rest = weeklyGoalWeekRepository.findByUser_IdAndWeekStart(user.getId(), ws).map(WeeklyGoalWeek::isRest).orElse(false);
        ShadowWeek week = weekRepository.findByUser_IdAndWeekStart(user.getId(), ws).orElse(null);
        if (week == null) {
            List<Integer> recent = weekRepository.findAllByUser_IdAndWeekStartBetween(user.getId(),
                    ws.minusWeeks(ShadowRules.HP_WEEKS), ws.minusWeeks(1)).stream().map(ShadowWeek::getDamage).toList();
            week = weekRepository.save(ShadowWeek.builder().user(user).weekStart(ws).hp(ShadowRules.hp(recent))
                    .levelAtStart(level(user)).rest(rest).build());
        } else if (week.getKilledAt() == null && week.isRest() != rest) {
            week.setRest(rest);
        }
        return week;
    }

    private int level(User user) {
        return Math.max(1, profileRepository.findByUser(user).map(CharacterProfile::getLevel).orElse(1));
    }

    /** 공격을 지운 뒤 주 합계 · 각 공격의 남은 체력을 다시 계산한다. killed_at · rewarded 는 그대로 */
    private void recount(ShadowWeek week) {
        List<ShadowHit> hits = hitRepository.findAllByWeek_IdOrderByIdAsc(week.getId());
        int damage = 0;
        int crits = 0;
        for (ShadowHit h : hits) {
            damage += h.getDamage();
            if (h.isCrit()) crits++;
            h.setHpAfter(ShadowRules.remaining(week.getHp(), damage));
        }
        week.setDamage(damage);
        week.setHits(hits.size());
        week.setCrits(crits);
        weekRepository.save(week);
    }

    /** 저장된 공격들을 순서대로 되감아 공격 전후 체력 · 처치 여부를 채운다(보상은 응답에 다시 싣지 않는다) */
    private List<ShadowHitResponse> replay(ShadowWeek week, List<ShadowHit> hits) {
        List<ShadowHitResponse> out = new ArrayList<>(hits.size());
        int cumulative = 0;
        boolean killedBefore = false;
        for (ShadowHit h : hits) {
            int before = ShadowRules.remaining(week.getHp(), cumulative);
            cumulative += h.getDamage();
            int after = ShadowRules.remaining(week.getHp(), cumulative);
            boolean killedNow = week.getKilledAt() != null && !killedBefore && cumulative >= week.getHp();
            if (killedNow) killedBefore = true;
            out.add(new ShadowHitResponse(h.getId(), h.getSource(), h.getHitOn(), week.getHp(), h.getRaw(), h.getDamage(), h.isCrit(), before, after, killedNow,
                    ShadowRules.overkillPct(week.getHp(), cumulative), null));
        }
        return out;
    }
}
