package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.shadow.ShadowChargeResponse;
import com.ajou.muscleup.dto.shadow.ShadowHistoryItem;
import com.ajou.muscleup.dto.shadow.ShadowHitResponse;
import com.ajou.muscleup.dto.shadow.ShadowMobView;
import com.ajou.muscleup.dto.shadow.ShadowStatusResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.RunSession;
import com.ajou.muscleup.entity.ShadowCharge;
import com.ajou.muscleup.entity.ShadowHit;
import com.ajou.muscleup.entity.ShadowMob;
import com.ajou.muscleup.entity.ShadowWeek;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WeeklyGoalWeek;
import com.ajou.muscleup.entity.WorkoutSession;
import com.ajou.muscleup.entity.WorkoutSet;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.RunSessionRepository;
import com.ajou.muscleup.repository.ShadowChargeRepository;
import com.ajou.muscleup.repository.ShadowHitRepository;
import com.ajou.muscleup.repository.ShadowMobRepository;
import com.ajou.muscleup.repository.ShadowWeekRepository;
import com.ajou.muscleup.repository.UserCollectionItemRepository;
import com.ajou.muscleup.repository.WeeklyGoalWeekRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 주간 보스 "그림자"(docs/design/shadow-boss.md) + 던전(docs/design/shadow-dungeon.md). 그림자 = 지난 4주의 나.
 * - 한 주 = 월~일(WeeklyGoalService.weekStart, KST Clock). 주 행은 상태를 보거나 처음 충전할 때 만든다.
 * - 저장(운동 세션 · 러닝)은 공격이 아니라 **힘 모으기**: 종목 category 별 통(LEGS · CHEST · BACK · ARMS · RUN)에 쌓인다(하루 상한 300, PR 이면 치명타 토큰 +1).
 * - 던전 strike: 통에서 60씩 꺼내 기술로 때린다. 타이밍(PERFECT +10% · GOOD +5%) · 패시브(각 +5%, 합 15%) · 내가 고른 타에 치명타 토큰.
 * - 안 쓴 힘은 주가 끝나면 자동 정산(ShadowScheduler 월요일 00:05, 못 돌았으면 상태를 볼 때) — 보너스 없이 기본 공격, 토큰은 큰 통부터.
 * - 휴식 주(WeeklyGoalWeek.rest)는 그림자가 잠든다: 힘은 쌓이고 때릴 수도 있지만 처치되지 않고, 연속 처치도 끊기지 않는다.
 * - 처치 보상은 한 주 한 번: 캐릭터 점수 +10(applyAttendance), 상자 1개(SHADOW), 칭호(업적 SHADOW_1 · SHADOW_STREAK_4).
 * - 세션 · 러닝을 지우면 모은 힘을 통에서 빼고, 이미 쓴 힘이면 마지막 타부터 깎아 합계를 다시 더한다. 처치 · 보상은 되돌리지 않는다.
 * - 1차 때 생긴 공격 행(source SESSION · RUN)은 그대로 되감기 · 삭제된다. 숫자 규칙은 모두 ShadowRules.
 * - 지도판(docs/design/shadow-dungeon-map.md): 주마다 잡몹 4마리(+ 희귀). strike 의 target 으로 잡몹을 치면 체력을 채우는 만큼만 쓰고
 *   남는 힘은 통으로 돌려준다(오버킬 없음). 잡으면 조각, 종류별 첫 처치는 도감 카드. 잡몹에 쓴 힘(mob_force)도 다음 주 체력 계산에 센다.
 *   세션을 지울 때 이미 쓴 힘은 보스 타에서만 깎는다(잡몹 처치 · 조각은 되돌리지 않는다).
 */
@Service
@RequiredArgsConstructor
public class ShadowBossService {
    static final int MAX_HISTORY_WEEKS = 52;
    /** 능력치 "지구력"에 보는 주 수 */
    static final int STATS_RUN_WEEKS = 4;
    /** 출석 연속일을 셀 때 보는 날 수 */
    static final int STREAK_LOOKBACK_DAYS = 120;

    private final ShadowWeekRepository weekRepository;
    private final ShadowHitRepository hitRepository;
    private final ShadowChargeRepository chargeRepository;
    private final ShadowMobRepository mobRepository;
    private final WeeklyGoalWeekRepository weeklyGoalWeekRepository;
    private final CharacterProfileRepository profileRepository;
    private final RunSessionRepository runRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final UserCollectionItemRepository itemRepository;
    private final CharacterGrowthService characterGrowthService;
    private final CollectionService collectionService;
    private final LiftService liftService;
    private final WeeklyGoalService weeklyGoalService;
    private final ExerciseCatalog catalog;
    private final Clock clock;

    // ---------------- 보기 ----------------

    /** 이번 주 상태(없으면 이번 주 행을 만든다). 지난 주에 안 쓴 힘이 남아 있으면 먼저 정산한다 */
    @Transactional
    public ShadowStatusResponse status(User user) {
        LocalDate today = LocalDate.now(clock);
        LocalDate ws = WeeklyGoalService.weekStart(today);
        settleOld(user, ws);
        ShadowWeek week = currentWeek(user, ws);
        Set<String> passives = passives(user, week, ws);
        List<ShadowHitResponse> hits = replay(week, hitRepository.findAllByWeek_IdOrderByIdAsc(week.getId()), passives);
        List<ShadowWeek> recent = weekRepository.findAllByUser_IdAndWeekStartBetween(user.getId(),
                ws.minusWeeks(ShadowRules.STREAK_LOOKBACK_WEEKS), ws);
        ShadowStatusResponse.LastWeek last = recent.stream().filter(w -> w.getWeekStart().equals(ws.minusWeeks(1))).findFirst()
                .map(w -> new ShadowStatusResponse.LastWeek(w.getHp(), w.getDamage(), w.getKilledAt() != null, w.isRest()))
                .orElse(null);
        return new ShadowStatusResponse(ShadowRules.NAME, ws, ws.plusDays(6), week.isRest(), week.getHp(), week.getDamage(),
                ShadowRules.remaining(week.getHp(), week.getDamage()), week.getKilledAt() != null, week.getKilledAt(),
                ShadowRules.overkillPct(week.getHp(), week.getDamage()), week.getLevelAtStart(), hits,
                ShadowRules.streakWeeks(recent, ws), last,
                chargeMap(week), week.chargeTotal(), week.getCritTokens(), List.copyOf(passives), stats(user, week, ws, today),
                mobRepository.findAllByWeek_IdOrderBySlotAsc(week.getId()).stream().map(ShadowBossService::mobView).toList());
    }

    /** 최근 n 주 전적(이번 주 포함, 최근 순). 행이 없는 주는 빠진다 */
    @Transactional
    public List<ShadowHistoryItem> history(User user, int weeks) {
        int n = Math.max(1, Math.min(weeks, MAX_HISTORY_WEEKS));
        LocalDate ws = WeeklyGoalService.weekStart(LocalDate.now(clock));
        settleOld(user, ws);
        return weekRepository.findAllByUser_IdAndWeekStartBetweenOrderByWeekStartDesc(user.getId(), ws.minusWeeks(n - 1), ws).stream()
                .map(w -> new ShadowHistoryItem(w.getWeekStart(), w.getHp(), w.getDamage(), w.getKilledAt() != null, w.isRest()))
                .toList();
    }

    // ---------------- 힘 모으기(저장) ----------------

    /**
     * 운동 세션을 저장한 뒤(같은 트랜잭션). 세트마다 무게 × 횟수(맨몸은 횟수 × 20kg)를 종목 category 의 통에 더한다.
     * hasPr: 이 세션에서 개인 최고가 하나라도 나왔는지 → 치명타 토큰 1개(세션당 한 번). 힘 합계가 1 미만이면 null
     */
    @Transactional
    public ShadowChargeResponse onSession(User user, WorkoutSession session, boolean hasPr) {
        List<String> codes = session.getSets().stream().map(WorkoutSet::getExercise).distinct().toList();
        Map<String, ExerciseCatalog.ExerciseDef> defs = catalog.describe(codes);
        Map<String, Double> volumeBySkill = new LinkedHashMap<>();
        for (WorkoutSet set : session.getSets()) {
            ExerciseCatalog.ExerciseDef def = defs.get(set.getExercise());
            String skill = ShadowRules.skillOf(def == null ? null : def.category());
            double volume = set.getWeightKg() * set.getReps();
            if (def != null && def.bodyweight()) volume += set.getReps() * ShadowRules.BODYWEIGHT_KG;
            volumeBySkill.merge(skill, volume, Double::sum);
        }
        Map<String, Integer> rawBySkill = new LinkedHashMap<>();
        int total = 0;
        for (String skill : ShadowRules.SKILLS) {
            Double volume = volumeBySkill.get(skill);
            if (volume == null) continue;
            int raw = ShadowRules.sessionForce(volume, 0);
            if (raw > 0) {
                rawBySkill.put(skill, raw);
                total += raw;
            }
        }
        if (total < ShadowRules.MIN_FORCE) return null;
        return charge(user, ShadowHit.SESSION, session.getId(), rawBySkill, hasPr);
    }

    /** 러닝을 저장한 뒤(같은 트랜잭션): 거리 ÷ 100 을 돌진 통에. hasRecord: 기록(거리 · 1/5/10km)을 깼는지 → 치명타 토큰 */
    @Transactional
    public ShadowChargeResponse onRun(User user, RunSession run, boolean hasRecord) {
        int raw = ShadowRules.runForce(run.getDistanceM());
        if (raw < ShadowRules.MIN_FORCE) return null;
        return charge(user, ShadowHit.RUN, run.getId(), Map.of(ShadowRules.RUN, raw), hasRecord);
    }

    private ShadowChargeResponse charge(User user, String source, Long sourceId, Map<String, Integer> rawBySkill, boolean record) {
        LocalDate today = LocalDate.now(clock);
        ShadowWeek week = currentWeek(user, WeeklyGoalService.weekStart(today));
        long room = Math.max(0, ShadowRules.DAILY_CAP - chargeRepository.sumRawByWeekAndDay(week.getId(), today));

        // 큰 통부터 채운다(상한에 걸리면 작은 통이 못 받는다)
        List<Map.Entry<String, Integer>> order = new ArrayList<>(rawBySkill.entrySet());
        order.sort(Comparator.comparingInt((Map.Entry<String, Integer> e) -> e.getValue()).reversed());
        Map<String, Integer> charged = new LinkedHashMap<>();
        List<ShadowCharge> rows = new ArrayList<>();
        int total = 0;
        boolean capped = false;
        for (Map.Entry<String, Integer> e : order) {
            int raw = e.getValue();
            if (raw <= 0) continue;
            int force = (int) Math.min(raw, room);
            room -= force;
            if (force < raw) capped = true;
            week.addCharge(e.getKey(), force);
            if (force > 0) charged.put(e.getKey(), force);
            total += force;
            rows.add(ShadowCharge.builder().week(week).user(user).source(source).sourceId(sourceId).skill(e.getKey())
                    .hitOn(today).raw(raw).gained(force).critToken(false).build());
        }
        boolean token = record && total > 0;
        if (token) {
            week.setCritTokens(week.getCritTokens() + 1);
            rows.get(0).setCritToken(true); // 가장 큰 통의 줄에
        }
        chargeRepository.saveAll(rows);
        weekRepository.save(week);
        Map<String, Integer> ordered = new LinkedHashMap<>();
        for (String skill : ShadowRules.SKILLS) {
            if (charged.containsKey(skill)) ordered.put(skill, charged.get(skill));
        }
        return new ShadowChargeResponse(ordered, total, token, capped, chargeMap(week), week.chargeTotal(), week.getCritTokens(),
                week.getHp(), ShadowRules.remaining(week.getHp(), week.getDamage()), week.getKilledAt() != null);
    }

    // ---------------- 던전 ----------------

    /** 던전에 들어옴(횟수만 센다) → 상태 */
    @Transactional
    public ShadowStatusResponse enter(User user) {
        ShadowWeek week = currentWeek(user, WeeklyGoalService.weekStart(LocalDate.now(clock)));
        week.setVisits(week.getVisits() + 1);
        weekRepository.save(week);
        return status(user);
    }

    /** 보스를 친다(target 없음) — 2차 화면 · 테스트가 쓰던 모양 */
    @Transactional
    public ShadowHitResponse strike(User user, String skill, String gradeIn, boolean useCrit) {
        return strike(user, null, skill, gradeIn, useCrit);
    }

    /**
     * 기술 한 번: 통에서 min(남은 힘, 60)을 꺼내 때린다. grade 는 클라이언트가 말하는 타이밍(보너스 상한 5% 라 속여도 작다).
     * useCrit 이고 토큰이 있으면 이 타가 치명타. 통이 비면 400. target 이 잡몹 id 면 그 잡몹을(strikeMob), 없거나 BOSS 면 보스를.
     */
    @Transactional
    public ShadowHitResponse strike(User user, String target, String skill, String gradeIn, boolean useCrit) {
        if (!ShadowRules.isSkill(skill)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모르는 기술이에요.");
        }
        String grade = ShadowRules.grade(gradeIn);
        LocalDate today = LocalDate.now(clock);
        LocalDate ws = WeeklyGoalService.weekStart(today);
        ShadowWeek week = currentWeek(user, ws);
        // 상대부터 확인(모르는 몬스터 404 · 쓰러짐 400) → 그다음 통
        ShadowMob mob = mobTarget(user, week, target);
        int pool = week.charge(skill);
        if (pool <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "이번 주 " + ShadowRules.POOL_LABEL.get(skill) + " 운동으로 모은 힘이 없어요. 운동하고 다시 와요.");
        }
        int force = ShadowRules.chunk(pool);
        boolean crit = useCrit && week.getCritTokens() > 0;
        if (crit) week.setCritTokens(week.getCritTokens() - 1);
        if (mob != null) return strikeMob(user, week, ws, today, mob, skill, grade, force, crit);
        week.addCharge(skill, -force);

        Set<String> passives = passives(user, week, ws);
        int bonusPct = ShadowRules.timingPct(grade) + ShadowRules.passivePct(skill, passives);
        double critMultiplier = ShadowRules.critMultiplier(week.getLevelAtStart(), passives.contains(ShadowRules.PASSIVE_HUNTER));
        int damage = ShadowRules.strikeDamage(force, bonusPct, crit, critMultiplier);
        int bonus = ShadowRules.boosted(force, bonusPct) - force;
        return apply(user, week, ShadowHit.DUNGEON, today, force, damage, crit, skill, grade, bonus, passives, true);
    }

    // ---------------- 정산 ----------------

    /** 지난 주 이전인데 정산 안 된 주 id 들(스케줄러용) */
    @Transactional(readOnly = true)
    public List<Long> unsettledWeekIds() {
        LocalDate ws = WeeklyGoalService.weekStart(LocalDate.now(clock));
        return weekRepository.findAllBySettledFalseAndWeekStartBefore(ws).stream().map(ShadowWeek::getId).toList();
    }

    /** 한 주 정산(따로 트랜잭션) */
    @Transactional
    public void settleWeek(Long weekId) {
        weekRepository.findById(weekId).ifPresent(this::settle);
    }

    private void settleOld(User user, LocalDate ws) {
        for (ShadowWeek w : weekRepository.findAllByUser_IdAndSettledFalseAndWeekStartBefore(user.getId(), ws)) {
            settle(w);
        }
    }

    /** 남은 힘을 통째로(큰 통부터) 기본 공격으로 넣는다 — 보너스 없음, 토큰은 큰 통부터 하나씩. 날은 그 주 일요일 */
    private void settle(ShadowWeek week) {
        if (week.isSettled()) return;
        User user = week.getUser();
        LocalDate sunday = week.getWeekStart().plusDays(6);
        List<String> order = new ArrayList<>(ShadowRules.SKILLS);
        order.sort(Comparator.comparingInt((String s) -> week.charge(s)).reversed());
        for (String skill : order) {
            int force = week.charge(skill);
            if (force <= 0) continue;
            week.addCharge(skill, -force);
            boolean crit = week.getCritTokens() > 0;
            if (crit) week.setCritTokens(week.getCritTokens() - 1);
            int damage = ShadowRules.strikeDamage(force, 0, crit, ShadowRules.critMultiplier(week.getLevelAtStart()));
            apply(user, week, ShadowHit.SETTLE, sunday, force, damage, crit, skill, null, 0, Set.of(), false);
        }
        week.setCritTokens(0);
        week.setSettled(true);
        weekRepository.save(week);
    }

    // ---------------- 지우기 ----------------

    /**
     * 세션 · 러닝을 지울 때: 모은 힘을 통에서 빼고(안 쓴 만큼), 이미 쓴 힘은 마지막 타부터 깎는다. 토큰도 안 쓴 게 있으면 뺀다.
     * 1차 공격 행(SESSION · RUN 이 곧 공격이던 때)도 같이 지운다. 처치 · 보상은 되돌리지 않는다
     */
    @Transactional
    public void onDeleted(String source, Long sourceId) {
        Map<Long, ShadowWeek> weeks = new LinkedHashMap<>();
        List<ShadowCharge> charges = chargeRepository.findAllBySourceAndSourceId(source, sourceId);
        for (ShadowCharge c : charges) {
            ShadowWeek week = c.getWeek();
            weeks.put(week.getId(), week);
            int take = Math.min(week.charge(c.getSkill()), c.getGained());
            week.addCharge(c.getSkill(), -take);
            int spent = c.getGained() - take;
            if (spent > 0) reduceSpent(week, spent);
            if (c.isCritToken() && week.getCritTokens() > 0) week.setCritTokens(week.getCritTokens() - 1);
        }
        List<ShadowHit> legacy = hitRepository.findAllBySourceAndSourceId(source, sourceId);
        for (ShadowHit h : legacy) {
            weeks.put(h.getWeek().getId(), h.getWeek());
        }
        if (charges.isEmpty() && legacy.isEmpty()) return;
        chargeRepository.deleteAll(charges);
        hitRepository.deleteAll(legacy);
        hitRepository.flush();
        for (ShadowWeek week : weeks.values()) {
            recount(week);
        }
    }

    /** 이미 쓴 힘을 마지막 타부터 깎는다(연출용 분배는 되감기 때 다시 계산) */
    private void reduceSpent(ShadowWeek week, int amount) {
        List<ShadowHit> hits = hitRepository.findAllByWeek_IdOrderByIdAsc(week.getId());
        for (int i = hits.size() - 1; i >= 0 && amount > 0; i--) {
            ShadowHit h = hits.get(i);
            int cut = Math.min(h.getDamage(), amount);
            h.setDamage(h.getDamage() - cut);
            h.setBonus(Math.min(h.getBonus(), h.getDamage()));
            amount -= cut;
        }
    }

    // ---------------- 안쪽 ----------------

    /** 한 타를 주에 넣는다: 합계 · 처치 · 보상 · 행 */
    private ShadowHitResponse apply(User user, ShadowWeek week, String source, LocalDate day, int raw, int damage, boolean crit,
                                    String skill, String grade, int bonus, Set<String> passives, boolean withLeft) {
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
        ShadowHit hit = hitRepository.save(ShadowHit.builder().week(week).user(user).source(source).sourceId(0L).hitOn(day)
                .raw(raw).damage(damage).crit(crit).hpAfter(after).skill(skill).grade(grade).bonus(bonus).build());
        return new ShadowHitResponse(hit.getId(), source, day, week.getHp(), raw, damage, crit, before, after, killedNow,
                ShadowRules.overkillPct(week.getHp(), week.getDamage()), reward,
                skill, grade, bonus, ShadowRules.shares(skill, damage, passives),
                withLeft ? chargeMap(week) : null, withLeft ? week.getCritTokens() : null, null);
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

    /** 이번 주 행(없으면 만든다 — 정산 전 settled=false). 휴식 여부는 주간 목표의 휴식 주를 그때그때 따라간다(처치한 뒤에는 고정) */
    private ShadowWeek currentWeek(User user, LocalDate ws) {
        boolean rest = weeklyGoalWeekRepository.findByUser_IdAndWeekStart(user.getId(), ws).map(WeeklyGoalWeek::isRest).orElse(false);
        ShadowWeek week = weekRepository.findByUser_IdAndWeekStart(user.getId(), ws).orElse(null);
        if (week == null) {
            List<Integer> recent = weekRepository.findAllByUser_IdAndWeekStartBetween(user.getId(),
                    ws.minusWeeks(ShadowRules.HP_WEEKS), ws.minusWeeks(1)).stream().map(w -> w.getDamage() + w.getMobForce()).toList();
            week = weekRepository.save(ShadowWeek.builder().user(user).weekStart(ws).hp(ShadowRules.hp(recent))
                    .levelAtStart(level(user)).rest(rest).settled(false).build());
        } else if (week.getKilledAt() == null && week.isRest() != rest) {
            week.setRest(rest);
        }
        ensureMobs(user, week);
        return week;
    }

    /** 이번 주 잡몹이 없으면 만든다(새 주 · 배포 전에 생긴 이번 주 행). 지난주 보스를 크게 오버킬했으면 희귀 1 더 */
    private void ensureMobs(User user, ShadowWeek week) {
        if (week.getId() == null || !mobRepository.findAllByWeek_IdOrderBySlotAsc(week.getId()).isEmpty()) return;
        boolean rare = weekRepository.findByUser_IdAndWeekStart(user.getId(), week.getWeekStart().minusWeeks(1))
                .filter(w -> w.getKilledAt() != null && ShadowRules.overkillPct(w.getHp(), w.getDamage()) >= ShadowRules.RARE_OVERKILL_PCT)
                .isPresent();
        List<ShadowRules.MobDef> lineup = ShadowRules.mobLineup(user.getId(), week.getWeekStart(), rare);
        List<ShadowMob> rows = new ArrayList<>(lineup.size());
        for (int i = 0; i < lineup.size(); i++) {
            ShadowRules.MobDef def = lineup.get(i);
            rows.add(ShadowMob.builder().week(week).user(user).code(def.code()).slot(i).hp(ShadowRules.mobHp(week.getHp(), def)).build());
        }
        mobRepository.saveAll(rows);
    }

    /** strike 의 target → 이번 주 내 잡몹(없으면 보스 = null). 남의 것 · 모르는 id 404, 지난주 것 · 이미 쓰러짐 400 */
    private ShadowMob mobTarget(User user, ShadowWeek week, String target) {
        if (target == null || target.isBlank() || ShadowRules.TARGET_BOSS.equalsIgnoreCase(target.trim())) return null;
        long id;
        try {
            id = Long.parseLong(target.trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "모르는 상대예요.");
        }
        ShadowMob mob = mobRepository.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "그 몬스터를 찾을 수 없어요."));
        if (!mob.getWeek().getId().equals(week.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지난주 몬스터예요. 이번 주 던전에서 다시 만나요.");
        }
        if (mob.getKilledAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 쓰러진 몬스터예요.");
        }
        return mob;
    }

    /**
     * 잡몹 한 타: 꺼낸 힘(force) 중 남은 체력을 채우는 최소만 쓰고 나머지는 통으로(오버킬 없음).
     * 쓰러지면 조각 · 종류별 첫 처치 표시. 잡몹 피해는 보스 합계(shadow_hits)에 넣지 않는다.
     */
    private ShadowHitResponse strikeMob(User user, ShadowWeek week, LocalDate ws, LocalDate today, ShadowMob mob,
                                        String skill, String grade, int force, boolean crit) {
        ShadowRules.MobDef def = ShadowRules.MOBS.getOrDefault(mob.getCode(), ShadowRules.TOMORROW);
        Set<String> passives = passives(user, week, ws);
        int bonusPct = ShadowRules.timingPct(grade) + ShadowRules.passivePct(skill, passives);
        double critMultiplier = ShadowRules.critMultiplier(week.getLevelAtStart(), passives.contains(ShadowRules.PASSIVE_HUNTER));
        int before = Math.max(0, mob.getHp() - mob.getDamage());
        int used = ShadowRules.neededForce(force, before, bonusPct, crit, critMultiplier);
        int dealt = Math.min(before, ShadowRules.strikeDamage(used, bonusPct, crit, critMultiplier));
        int bonus = Math.min(dealt, ShadowRules.boosted(used, bonusPct) - used);
        week.addCharge(skill, -used);
        week.setMobForce(week.getMobForce() + used);
        mob.setDamage(mob.getDamage() + dealt);
        int after = Math.max(0, mob.getHp() - mob.getDamage());

        boolean killedNow = after == 0;
        int shards = 0;
        boolean firstKill = false;
        if (killedNow) {
            firstKill = mobRepository.countByUser_IdAndCodeAndKilledAtIsNotNull(user.getId(), mob.getCode()) == 0;
            mob.setKilledAt(LocalDateTime.now(clock));
            shards = def.shards();
            collectionService.grantShards(user, shards);
        }
        mobRepository.save(mob);
        weekRepository.save(week);
        return new ShadowHitResponse(mob.getId(), ShadowHit.MOB, today, mob.getHp(), used, dealt, crit, before, after, killedNow, 0, null,
                skill, grade, bonus, ShadowRules.shares(skill, dealt, passives), chargeMap(week), week.getCritTokens(),
                new ShadowHitResponse.MobHit(mob.getId(), mob.getCode(), def.name(), def.rare(), force - used, shards, firstKill));
    }

    static ShadowMobView mobView(ShadowMob m) {
        ShadowRules.MobDef def = ShadowRules.MOBS.getOrDefault(m.getCode(), ShadowRules.TOMORROW);
        return new ShadowMobView(m.getId(), m.getCode(), def.name(), m.getSlot(), m.getHp(), Math.max(0, m.getHp() - m.getDamage()),
                m.getKilledAt() != null, def.rare(), def.shards());
    }

    private int level(User user) {
        return Math.max(1, profileRepository.findByUser(user).map(CharacterProfile::getLevel).orElse(1));
    }

    /** 통별 남은 힘(LEGS · CHEST · BACK · ARMS · RUN 순, 0 도 넣는다) */
    static Map<String, Integer> chargeMap(ShadowWeek week) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String skill : ShadowRules.SKILLS) {
            out.put(skill, week.charge(skill));
        }
        return out;
    }

    /**
     * 켜진 패시브(저장 안 함, 볼 때마다 계산 — 꾸미기와 같은 방식).
     * 삼대장: 3대 추정 1RM 합 ≥ 300kg(여 200), 장거리: 이번 주 러닝 ≥ 10km, 꾸준함: 이번 주 출석 ≥ 3일, 사냥꾼: 칭호 T_SHADOW_STREAK_4
     */
    private Set<String> passives(User user, ShadowWeek week, LocalDate ws) {
        Set<String> out = new LinkedHashSet<>();
        boolean female = profileRepository.findByUser(user).map(CharacterProfile::getGender).filter(Gender.FEMALE::equals).isPresent();
        if (bigThreeKg(user) >= (female ? ShadowRules.BIG_THREE_KG_FEMALE : ShadowRules.BIG_THREE_KG)) out.add(ShadowRules.PASSIVE_BIG_THREE);
        if (runMeters(user, ws, ws.plusDays(6)) >= ShadowRules.LONG_RUN_M) out.add(ShadowRules.PASSIVE_LONG_RUN);
        if (attendanceLogRepository.countByUserAndDidWorkoutTrueAndDateBetween(user, ws, ws.plusDays(6)) >= ShadowRules.STEADY_DAYS) {
            out.add(ShadowRules.PASSIVE_STEADY);
        }
        if (itemRepository.existsByUser_IdAndItemCode(user.getId(), "T_SHADOW_STREAK_4")) out.add(ShadowRules.PASSIVE_HUNTER);
        return out;
    }

    /** 능력치 — 전부 기존 기록에서 읽는다(새 저장 없음) */
    private ShadowStatusResponse.Stats stats(User user, ShadowWeek week, LocalDate ws, LocalDate today) {
        int strength = (int) Math.round(bigThreeKg(user));
        double enduranceKm = Math.round(runMeters(user, ws.minusWeeks(STATS_RUN_WEEKS - 1), ws.plusDays(6)) / 100.0) / 10.0;
        return new ShadowStatusResponse.Stats(strength, enduranceKm, attendanceStreak(user, today),
                weeklyGoalService.status(user).streakWeeks(), week.getLevelAtStart());
    }

    private double bigThreeKg(User user) {
        return liftService.bests(user).stream().filter(LiftService.Best::bigThree).mapToDouble(LiftService.Best::e1rm).sum();
    }

    private long runMeters(User user, LocalDate from, LocalDate to) {
        return runRepository.findAllByUser_IdAndPerformedOnBetweenOrderByStartedAtDesc(user.getId(), from, to).stream()
                .mapToLong(RunSession::getDistanceM).sum();
    }

    /** 출석 연속일: 오늘(아직 안 했으면 어제)부터 거꾸로 운동한 날을 센다 */
    private int attendanceStreak(User user, LocalDate today) {
        Set<LocalDate> days = new HashSet<>();
        for (AttendanceLog log : attendanceLogRepository.findAllByUserAndDateBetweenOrderByDateAsc(user, today.minusDays(STREAK_LOOKBACK_DAYS), today)) {
            if (log.isDidWorkout()) days.add(log.getDate());
        }
        LocalDate cursor = days.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    /** 공격을 지우거나 깎은 뒤 주 합계 · 각 공격의 남은 체력을 다시 계산한다. killed_at · rewarded 는 그대로 */
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

    /** 저장된 공격들을 순서대로 되감아 공격 전후 체력 · 처치 여부를 채운다(보상 · 남은 통은 다시 싣지 않는다) */
    private List<ShadowHitResponse> replay(ShadowWeek week, List<ShadowHit> hits, Set<String> passives) {
        List<ShadowHitResponse> out = new ArrayList<>(hits.size());
        int cumulative = 0;
        boolean killedBefore = false;
        for (ShadowHit h : hits) {
            int before = ShadowRules.remaining(week.getHp(), cumulative);
            cumulative += h.getDamage();
            int after = ShadowRules.remaining(week.getHp(), cumulative);
            boolean killedNow = week.getKilledAt() != null && !killedBefore && cumulative >= week.getHp();
            if (killedNow) killedBefore = true;
            out.add(new ShadowHitResponse(h.getId(), h.getSource(), h.getHitOn(), week.getHp(), h.getRaw(), h.getDamage(), h.isCrit(),
                    before, after, killedNow, ShadowRules.overkillPct(week.getHp(), cumulative), null,
                    h.getSkill(), h.getGrade(), h.getBonus(), ShadowRules.shares(h.getSkill(), h.getDamage(), passives), null, null, null));
        }
        return out;
    }
}
