package com.ajou.muscleup.service;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.dto.shadow.ShadowChargeResponse;
import com.ajou.muscleup.dto.shadow.ShadowHistoryItem;
import com.ajou.muscleup.dto.shadow.ShadowHitResponse;
import com.ajou.muscleup.dto.shadow.ShadowMobView;
import com.ajou.muscleup.dto.shadow.ShadowStatusResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.RunSession;
import com.ajou.muscleup.entity.ShadowMob;
import com.ajou.muscleup.entity.ShadowWeek;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WeeklyGoalWeek;
import com.ajou.muscleup.entity.WorkoutSession;
import com.ajou.muscleup.entity.WorkoutSet;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.ShadowChargeRepository;
import com.ajou.muscleup.repository.ShadowHitRepository;
import com.ajou.muscleup.repository.ShadowMobRepository;
import com.ajou.muscleup.repository.ShadowWeekRepository;
import com.ajou.muscleup.repository.UserCollectionItemRepository;
import com.ajou.muscleup.repository.UserCollectionRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 주간 보스 "그림자" + 던전(docs/design/shadow-boss.md 7절 · shadow-dungeon.md 7절 "A").
 * 오늘을 2026-10-15(목) 12:00 KST 로 고정 — 이번 주는 10-12(월)~10-18(일).
 * 2차부터 저장은 공격이 아니라 힘 모으기(통) → strike 로 때린다. 1차 규칙(체력 · 상한 · 처치 보상 · 연속 · 휴식)은 그대로 유지된다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ShadowBossServiceTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 15);
    static final LocalDate WEEK = LocalDate.of(2026, 10, 12);

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(TODAY.atTime(12, 0).atZone(TimeConfig.KST).toInstant(), TimeConfig.KST);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired UserRepository users;
    @Autowired ShadowWeekRepository weeks;
    @Autowired ShadowHitRepository hits;
    @Autowired ShadowChargeRepository charges;
    @Autowired ShadowMobRepository mobs;
    @Autowired CharacterProfileRepository profiles;
    @Autowired UserCollectionRepository wallets;
    @Autowired UserCollectionItemRepository items;
    @Autowired ShadowBossService shadow;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = save("sb-alice@test.local");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    /** 저장된 운동 세션(검증을 거치지 않고 바로 표에). 볼륨 = 무게 × 횟수 × 세트, 종목 category 가 통을 정한다 */
    private WorkoutSession session(User u, String exercise, double weight, int reps, int sets) {
        WorkoutSession s = WorkoutSession.builder().user(u).performedOn(TODAY).startedAt(TODAY.atTime(10, 0)).endedAt(TODAY.atTime(11, 0))
                .durationSec(3600).totalVolume(weight * reps * sets).totalSets(sets).build();
        for (int i = 0; i < sets; i++) {
            s.getSets().add(WorkoutSet.builder().session(s).exercise(exercise).exerciseOrder(0).setOrder(i).weightKg(weight).reps(reps).build());
        }
        em.persist(s);
        em.flush();
        return s;
    }

    /** 스쿼트 100kg × 10회 × n세트 → 볼륨 1,000 × n → 하체 통에 10 × n */
    private WorkoutSession squat(User u, int sets) {
        return session(u, "SQUAT", 100, 10, sets);
    }

    private RunSession run(User u, int distanceM) {
        RunSession r = RunSession.builder().user(u).performedOn(TODAY).startedAt(TODAY.atTime(7, 0)).endedAt(TODAY.atTime(7, 30))
                .durationSec(1800).distanceM(distanceM).source("GPS").build();
        em.persist(r);
        em.flush();
        return r;
    }

    private ShadowWeek week(User u, LocalDate weekStart, int hp, int damage, boolean killed, boolean rest) {
        ShadowWeek w = ShadowWeek.builder().user(u).weekStart(weekStart).hp(hp).damage(damage).hits(damage > 0 ? 1 : 0).levelAtStart(1)
                .killedAt(killed ? weekStart.atTime(20, 0) : null).rewarded(killed).rest(rest).settled(true).build();
        em.persist(w);
        em.flush();
        return w;
    }

    private ShadowWeek thisWeek() {
        return weeks.findByUser_IdAndWeekStart(alice.getId(), WEEK).orElseThrow();
    }

    // ---------------- 보기 · 체력 ----------------

    @Test
    void firstWeekHasHp100AndEmptyPools() {
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.name()).isEqualTo("그림자");
        assertThat(s.weekStart()).isEqualTo(WEEK);
        assertThat(s.weekEnd()).isEqualTo(LocalDate.of(2026, 10, 18));
        assertThat(s.hp()).isEqualTo(100);
        assertThat(s.damage()).isZero();
        assertThat(s.remaining()).isEqualTo(100);
        assertThat(s.killed()).isFalse();
        assertThat(s.rest()).isFalse();
        assertThat(s.hits()).isEmpty();
        assertThat(s.streakWeeks()).isZero();
        assertThat(s.lastWeek()).isNull();
        assertThat(s.level()).isEqualTo(1);
        // 2차: 통 5개(순서 고정) 전부 0 · 토큰 0 · 패시브 없음 · 능력치 0
        assertThat(s.charge().keySet()).containsExactly("LEGS", "CHEST", "BACK", "ARMS", "RUN");
        assertThat(s.charge().values()).containsOnly(0);
        assertThat(s.chargeTotal()).isZero();
        assertThat(s.critTokens()).isZero();
        assertThat(s.passives()).isEmpty();
        assertThat(s.stats().strengthKg()).isZero();
        assertThat(s.stats().enduranceKm()).isZero();
        assertThat(s.stats().attendanceStreak()).isZero();
        assertThat(s.stats().weeklyStreak()).isZero();
        assertThat(s.stats().level()).isEqualTo(1);
        // 상태를 본 것만으로 이번 주 행이 생긴다 — 아직 정산 전
        assertThat(thisWeek().isSettled()).isFalse();
    }

    @Test
    void hpIsAverageOfPositiveWeeksAmongLastFourTimesMargin() {
        // 최근 4주 [0, 300, 500, 0] → round(400 × 1.05) = 420. 5주 전은 보지 않는다
        week(alice, WEEK.minusWeeks(1), 100, 0, false, false);
        week(alice, WEEK.minusWeeks(2), 100, 300, true, false);
        week(alice, WEEK.minusWeeks(3), 100, 500, true, false);
        week(alice, WEEK.minusWeeks(4), 100, 0, false, false);
        week(alice, WEEK.minusWeeks(5), 100, 5000, true, false);

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.hp()).isEqualTo(420);
        assertThat(s.lastWeek()).isNotNull();
        assertThat(s.lastWeek().damage()).isZero();
        assertThat(s.lastWeek().killed()).isFalse();

        assertThat(ShadowRules.hp(List.of())).isEqualTo(100);
        assertThat(ShadowRules.hp(List.of(10, 20))).isEqualTo(100); // 바닥값
        assertThat(ShadowRules.hp(List.of(0, 300, 500, 0))).isEqualTo(420);
    }

    // ---------------- 힘 모으기 ----------------

    @Test
    void sessionChargesPoolsByCategoryAndBodyweightCounts20kgPerRep() {
        // 스쿼트 6,000kg → 하체 60. 아직 공격은 없다(damage 0)
        ShadowChargeResponse c = shadow.onSession(alice, squat(alice, 6), false);
        assertThat(c.charged()).containsExactly(Map.entry("LEGS", 60));
        assertThat(c.total()).isEqualTo(60);
        assertThat(c.critToken()).isFalse();
        assertThat(c.capped()).isFalse();
        assertThat(c.chargeLeft().get("LEGS")).isEqualTo(60);
        assertThat(c.chargeTotal()).isEqualTo(60);
        assertThat(c.hp()).isEqualTo(100);
        assertThat(c.remaining()).isEqualTo(100);
        assertThat(c.killed()).isFalse();

        // 맨몸 턱걸이 8회 3세트: 무게 0 이라 볼륨 0 → 24회 × 20kg = 480kg → 4.8 → 5. 등 종목이라 BACK 통
        ShadowChargeResponse pullUps = shadow.onSession(alice, session(alice, "PULL_UP", 0, 8, 3), false);
        assertThat(pullUps.charged()).containsExactly(Map.entry("BACK", 5));

        // 한 세션에 종목이 섞이면 통도 나뉜다: 벤치 600kg → 가슴 6, 숄더프레스 400kg → 어깨 · 팔 통 4
        WorkoutSession mixed = session(alice, "BENCH", 60, 5, 2);
        mixed.getSets().add(WorkoutSet.builder().session(mixed).exercise("OHP").exerciseOrder(1).setOrder(0).weightKg(40).reps(10).build());
        em.flush();
        ShadowChargeResponse m = shadow.onSession(alice, mixed, false);
        assertThat(m.charged()).containsExactly(Map.entry("CHEST", 6), Map.entry("ARMS", 4));

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.damage()).isZero();
        assertThat(s.hits()).isEmpty();
        assertThat(s.charge()).containsExactly(Map.entry("LEGS", 60), Map.entry("CHEST", 6), Map.entry("BACK", 5), Map.entry("ARMS", 4), Map.entry("RUN", 0));
        assertThat(s.chargeTotal()).isEqualTo(75);
        assertThat(charges.findAllByWeek_IdOrderByIdAsc(thisWeek().getId())).hasSize(4);

        assertThat(ShadowRules.sessionForce(6000, 0)).isEqualTo(60);
        assertThat(ShadowRules.sessionForce(0, 24)).isEqualTo(5);
        assertThat(ShadowRules.runForce(5000)).isEqualTo(50);
        assertThat(ShadowRules.skillOf("SHOULDERS")).isEqualTo("ARMS");
        assertThat(ShadowRules.skillOf("CORE")).isEqualTo("ARMS");
        assertThat(ShadowRules.skillOf(null)).isEqualTo("ARMS");
        assertThat(ShadowRules.skillOf("LEGS")).isEqualTo("LEGS");
    }

    @Test
    void runChargesRunPoolAndTinyThingsChargeNothing() {
        ShadowChargeResponse r = shadow.onRun(alice, run(alice, 5200), false);
        assertThat(r.charged()).containsExactly(Map.entry("RUN", 52));
        assertThat(shadow.onRun(alice, run(alice, 40), false)).isNull();
        assertThat(shadow.onSession(alice, session(alice, "SQUAT", 10, 3, 1), false)).isNull();
        assertThat(shadow.status(alice).charge().get("RUN")).isEqualTo(52);
    }

    @Test
    void dailyCapIs300OnChargingAndFillsBigPoolsFirst() {
        assertThat(shadow.onSession(alice, squat(alice, 15), false).total()).isEqualTo(150);
        assertThat(shadow.onSession(alice, squat(alice, 15), false).total()).isEqualTo(150);
        // 세 번째: 하체 100 은 상한 밖 → 하나도 안 들어가고 capped
        ShadowChargeResponse third = shadow.onSession(alice, squat(alice, 10), false);
        assertThat(third.total()).isZero();
        assertThat(third.charged()).isEmpty();
        assertThat(third.capped()).isTrue();
        assertThat(shadow.status(alice).chargeTotal()).isEqualTo(300);

        // 다른 사람: 상한 10 남은 상태에서 하체 30 + 가슴 6 → 큰 통(하체)이 먼저 10 을 받고 가슴은 0
        User bob = save("sb-bob@test.local");
        shadow.onSession(bob, squat(bob, 29), false); // 290
        WorkoutSession mixed = session(bob, "SQUAT", 100, 10, 3);
        mixed.getSets().add(WorkoutSet.builder().session(mixed).exercise("BENCH").exerciseOrder(1).setOrder(0).weightKg(60).reps(10).build());
        em.flush();
        ShadowChargeResponse c = shadow.onSession(bob, mixed, false);
        assertThat(c.charged()).containsExactly(Map.entry("LEGS", 10));
        assertThat(c.capped()).isTrue();
        assertThat(shadow.status(bob).charge()).containsEntry("LEGS", 300).containsEntry("CHEST", 0);

        assertThat(ShadowRules.capped(100, 250)).isEqualTo(50);
        assertThat(ShadowRules.capped(100, 300)).isZero();
    }

    // ---------------- 던전 ----------------

    @Test
    void strikeTakes60PerPressAndTimingAddsAtMost10Pct() {
        week(alice, WEEK.minusWeeks(1), 100, 1000, true, false); // 체력 1,050 — 처치가 끼어들지 않게
        shadow.onSession(alice, squat(alice, 15), false); // 하체 150

        ShadowHitResponse miss = shadow.strike(alice, "LEGS", "MISS", false);
        assertThat(miss.source()).isEqualTo("DUNGEON");
        assertThat(miss.skill()).isEqualTo("LEGS");
        assertThat(miss.grade()).isEqualTo("MISS");
        assertThat(miss.raw()).isEqualTo(60);
        assertThat(miss.damage()).isEqualTo(60);
        assertThat(miss.bonus()).isZero();
        assertThat(miss.crit()).isFalse();
        assertThat(miss.hpBefore()).isEqualTo(1050);
        assertThat(miss.hpAfter()).isEqualTo(990);
        assertThat(miss.shares()).containsExactly(60);
        assertThat(miss.chargeLeft().get("LEGS")).isEqualTo(90);
        assertThat(miss.critTokensLeft()).isZero();
        assertThat(miss.hitOn()).isEqualTo(TODAY);

        ShadowHitResponse perfect = shadow.strike(alice, "LEGS", "PERFECT", false);
        assertThat(perfect.damage()).isEqualTo(63); // 60 + 5%
        assertThat(perfect.bonus()).isEqualTo(3);
        ShadowHitResponse good = shadow.strike(alice, "LEGS", "GOOD", false); // 남은 30
        assertThat(good.raw()).isEqualTo(30);
        assertThat(good.damage()).isEqualTo(31); // round(30 × 1.02 = 30.6)
        assertThat(good.chargeLeft().get("LEGS")).isZero();

        // 통이 비면 400 + 한국어 문구. 모르는 등급은 MISS, 모르는 기술은 400
        assertThatThrownBy(() -> shadow.strike(alice, "LEGS", "PERFECT", false))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("하체");
        assertThatThrownBy(() -> shadow.strike(alice, "FIRE", "PERFECT", false)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> shadow.strike(alice, "CHEST", null, false)).hasMessageContaining("가슴");

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.damage()).isEqualTo(154);
        assertThat(s.hits()).hasSize(3);
        assertThat(s.hits().get(1).grade()).isEqualTo("PERFECT");
        assertThat(s.hits().get(2).hpAfter()).isEqualTo(896);
        assertThat(thisWeek().getHits()).isEqualTo(3);

        assertThat(ShadowRules.chunk(150)).isEqualTo(60);
        assertThat(ShadowRules.chunk(30)).isEqualTo(30);
        assertThat(ShadowRules.timingPct("PERFECT")).isEqualTo(5);
        assertThat(ShadowRules.timingPct("GOOD")).isEqualTo(2);
        assertThat(ShadowRules.timingPct("whatever")).isZero();
        assertThat(ShadowRules.boosted(60, 5)).isEqualTo(63);
    }

    @Test
    void critTokenFromPrIsSpentOnTheStrikeIChooseScaledByLevel() {
        // Lv20 → ×1.7. 레벨은 주가 시작될 때 값으로 고정
        profiles.save(CharacterProfile.builder().user(alice).level(20).tier(CharacterTier.BRONZE).evolutionStage(0).title("리프터")
                .isPublic(false).attendancePoints(0).build());
        week(alice, WEEK.minusWeeks(1), 100, 1000, true, false);
        ShadowChargeResponse c = shadow.onSession(alice, squat(alice, 12), true); // PR → 토큰 1
        assertThat(c.critToken()).isTrue();
        assertThat(c.critTokens()).isEqualTo(1);
        assertThat(shadow.onSession(alice, squat(alice, 6), true).critTokens()).isEqualTo(2); // 세션마다 1개
        assertThat(shadow.status(alice).level()).isEqualTo(20);

        // 토큰을 안 켜면 그냥 60. 켜면 60 × 1.7 = 102, 토큰 하나 줄어듦
        assertThat(shadow.strike(alice, "LEGS", "MISS", false).crit()).isFalse();
        ShadowHitResponse crit = shadow.strike(alice, "LEGS", "MISS", true);
        assertThat(crit.crit()).isTrue();
        assertThat(crit.damage()).isEqualTo(102);
        assertThat(crit.critTokensLeft()).isEqualTo(1);
        // 타이밍 보너스 뒤에 배율: (60 + 5%) = 63 × 1.7 = 107.1 → 107
        ShadowHitResponse both = shadow.strike(alice, "LEGS", "PERFECT", true);
        assertThat(both.damage()).isEqualTo(107);
        assertThat(both.bonus()).isEqualTo(3);
        assertThat(both.critTokensLeft()).isZero();
        assertThat(thisWeek().getCrits()).isEqualTo(2);

        assertThat(ShadowRules.critMultiplier(20)).isEqualTo(1.7);
        assertThat(ShadowRules.strikeDamage(60, 0, true, 1.51)).isEqualTo(91); // Lv1
        assertThat(ShadowRules.strikeDamage(60, 5, true, 1.7)).isEqualTo(107);
    }

    @Test
    void passivesSteadyAndLongRunAddFivePctEachAndSplitTheDash() {
        week(alice, WEEK.minusWeeks(1), 100, 1000, true, false);
        // 이번 주 출석 3일 → 꾸준함. 러닝 10.4km → 장거리(돌진 통 104)
        for (int i = 0; i < 3; i++) {
            em.persist(AttendanceLog.builder().user(alice).date(WEEK.plusDays(i)).didWorkout(true).build());
        }
        shadow.onRun(alice, run(alice, 5200), false);
        shadow.onRun(alice, run(alice, 5200), false);
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.passives()).containsExactly("장거리", "꾸준함");
        assertThat(s.stats().enduranceKm()).isEqualTo(10.4);
        assertThat(s.stats().attendanceStreak()).isEqualTo(3); // 오늘(15)은 아직 → 어제(14)부터 거꾸로 12 까지 3일

        // 돌진 PERFECT: 5% + 5%(장거리) + 5%(꾸준함) = 15% → 69, 장거리라 2타 [34, 35]
        ShadowHitResponse dash = shadow.strike(alice, "RUN", "PERFECT", false);
        assertThat(dash.damage()).isEqualTo(69);
        assertThat(dash.bonus()).isEqualTo(9);
        assertThat(dash.shares()).containsExactly(34, 35);
        // 하체 기술엔 장거리가 안 붙는다: 60 + 5%(꾸준함) = 63
        shadow.onSession(alice, squat(alice, 6), false);
        assertThat(shadow.strike(alice, "LEGS", "MISS", false).damage()).isEqualTo(63);

        assertThat(ShadowRules.passivePct("RUN", Set.of("장거리", "꾸준함", "삼대장"))).isEqualTo(10);
        assertThat(ShadowRules.passivePct("LEGS", Set.of("장거리", "꾸준함", "삼대장"))).isEqualTo(10);
        assertThat(ShadowRules.passivePct("LEGS", Set.of("장거리"))).isZero();
        assertThat(ShadowRules.shares("ARMS", 60, Set.of())).containsExactly(15, 15, 15, 15);
        assertThat(ShadowRules.shares("ARMS", 7, Set.of())).containsExactly(1, 2, 2, 2);
        assertThat(ShadowRules.shares("BACK", 60, Set.of())).containsExactly(18, 42);
        assertThat(ShadowRules.shares("RUN", 60, Set.of())).containsExactly(60);
        assertThat(ShadowRules.shares("LEGS", 0, Set.of())).containsExactly(0);
    }

    @Test
    void attendanceStreakCountsBackFromTodayOrYesterday() {
        em.persist(AttendanceLog.builder().user(alice).date(TODAY.minusDays(1)).didWorkout(true).build());
        em.persist(AttendanceLog.builder().user(alice).date(TODAY.minusDays(2)).didWorkout(true).build());
        em.persist(AttendanceLog.builder().user(alice).date(TODAY.minusDays(3)).didWorkout(false).build());
        em.flush();
        assertThat(shadow.status(alice).stats().attendanceStreak()).isEqualTo(2);
        em.persist(AttendanceLog.builder().user(alice).date(TODAY).didWorkout(true).build());
        em.flush();
        assertThat(shadow.status(alice).stats().attendanceStreak()).isEqualTo(3);
    }

    @Test
    void bigThreePassiveAndStrengthComeFromLiftRecordsViaApi() throws Exception {
        // 첫 세션이라 스쿼트 · 벤치 · 데드 모두 PR(토큰 1). 추정 1RM: 100×(1+5/30)=116.7 + 70 + 140 = 326.7 ≥ 300 → 삼대장
        // 통: 하체 1,000kg → 10, 가슴 600 → 6, 등 1,200 → 12
        String body = mvc.perform(post("/api/workouts").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("""
                        {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:52:00Z",
                         "exercises":[
                           {"exercise":"SQUAT","sets":[{"weightKg":100,"reps":5},{"weightKg":100,"reps":5}]},
                           {"exercise":"BENCH","sets":[{"weightKg":60,"reps":5},{"weightKg":60,"reps":5}]},
                           {"exercise":"DEADLIFT","sets":[{"weightKg":120,"reps":5},{"weightKg":120,"reps":5}]}
                         ]}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.prs.length()").value(3))
                .andExpect(jsonPath("$.shadow").doesNotExist())
                .andExpect(jsonPath("$.shadowCharge.charged.LEGS").value(10))
                .andExpect(jsonPath("$.shadowCharge.charged.CHEST").value(6))
                .andExpect(jsonPath("$.shadowCharge.charged.BACK").value(12))
                .andExpect(jsonPath("$.shadowCharge.total").value(28))
                .andExpect(jsonPath("$.shadowCharge.critToken").value(true))
                .andExpect(jsonPath("$.shadowCharge.capped").value(false))
                .andExpect(jsonPath("$.shadowCharge.remaining").value(100))
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(body, "$.session.summary.id");

        mvc.perform(get("/api/shadow").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.damage").value(0))
                .andExpect(jsonPath("$.chargeTotal").value(28))
                .andExpect(jsonPath("$.critTokens").value(1))
                .andExpect(jsonPath("$.passives[0]").value("삼대장"))
                .andExpect(jsonPath("$.stats.strengthKg").value(327))
                .andExpect(jsonPath("$.stats.level").value(1));

        // 들어 던지기(등 12) + 삼대장 5% + 치명타 ×1.51: 12 → round(12.6)=13 → round(19.63)=20, 2타 [6, 14]
        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skill\":\"BACK\",\"grade\":\"MISS\",\"crit\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.raw").value(12))
                .andExpect(jsonPath("$.bonus").value(1))
                .andExpect(jsonPath("$.crit").value(true))
                .andExpect(jsonPath("$.damage").value(20))
                .andExpect(jsonPath("$.shares[0]").value(6))
                .andExpect(jsonPath("$.shares[1]").value(14))
                .andExpect(jsonPath("$.hpAfter").value(80))
                .andExpect(jsonPath("$.chargeLeft.BACK").value(0))
                .andExpect(jsonPath("$.critTokensLeft").value(0))
                .andExpect(content().string(not(containsString("@test.local"))));

        // 세션을 지우면: 안 쓴 힘(하체 10 · 가슴 6)은 통에서 빠지고, 이미 쓴 등 12 는 마지막 타에서 깎인다 → 피해 20 - 12 = 8
        mvc.perform(delete("/api/workouts/" + id).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/shadow").with(as(alice)))
                .andExpect(jsonPath("$.chargeTotal").value(0))
                .andExpect(jsonPath("$.damage").value(8))
                .andExpect(jsonPath("$.remaining").value(92))
                .andExpect(jsonPath("$.hits.length()").value(1))
                .andExpect(jsonPath("$.hits[0].damage").value(8));
        assertThat(charges.findAllBySourceAndSourceId("SESSION", id.longValue())).isEmpty();
    }

    @Test
    void killRewardsOncePerWeekThenOnlyOverkill() {
        shadow.onSession(alice, squat(alice, 12), false); // 하체 120
        shadow.strike(alice, "LEGS", "MISS", false);
        ShadowHitResponse kill = shadow.strike(alice, "LEGS", "MISS", false);
        assertThat(kill.killed()).isTrue();
        assertThat(kill.hpBefore()).isEqualTo(40);
        assertThat(kill.hpAfter()).isZero();
        assertThat(kill.overkillPct()).isEqualTo(20); // 120 / 100
        assertThat(kill.reward()).isNotNull();
        assertThat(kill.reward().points()).isEqualTo(10);
        assertThat(kill.reward().box()).isEqualTo(1);
        assertThat(kill.reward().titles()).contains("그림자를 넘은 자");

        // 보상이 실제로 들어갔다: 캐릭터 점수 +10 · 상자 +1 · 칭호(업적 SHADOW_1)
        assertThat(profiles.findByUser(alice).orElseThrow().getAttendancePoints()).isEqualTo(10);
        assertThat(wallets.findByUser_Id(alice.getId()).orElseThrow().getBoxes()).isEqualTo(1);
        assertThat(items.existsByUser_IdAndItemCode(alice.getId(), "T_SHADOW_1")).isTrue();
        assertThat(items.existsByUser_IdAndItemCode(alice.getId(), "T_SHADOW_STREAK_4")).isFalse();

        // 같은 주 세 번째 타: 오버킬만, 보상 없음
        shadow.onSession(alice, squat(alice, 6), false);
        ShadowHitResponse more = shadow.strike(alice, "LEGS", "MISS", false);
        assertThat(more.killed()).isFalse();
        assertThat(more.reward()).isNull();
        assertThat(more.hpBefore()).isZero();
        assertThat(more.overkillPct()).isEqualTo(80);
        assertThat(profiles.findByUser(alice).orElseThrow().getAttendancePoints()).isEqualTo(10);
        assertThat(wallets.findByUser_Id(alice.getId()).orElseThrow().getBoxes()).isEqualTo(1);

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.killed()).isTrue();
        assertThat(s.killedAt()).isEqualTo(TODAY.atTime(12, 0));
        assertThat(s.overkillPct()).isEqualTo(80);
        assertThat(s.streakWeeks()).isEqualTo(1);
        assertThat(s.hits()).extracting(ShadowHitResponse::killed).containsExactly(false, true, false);
        ShadowWeek row = thisWeek();
        assertThat(row.isRewarded()).isTrue();
        assertThat(row.getHits()).isEqualTo(3);
    }

    @Test
    void fourKillsInARowUnlockHunterTitleAndHunterPassive() {
        week(alice, WEEK.minusWeeks(1), 100, 120, true, false);
        week(alice, WEEK.minusWeeks(2), 100, 120, true, false);
        week(alice, WEEK.minusWeeks(3), 100, 120, true, false);
        shadow.onSession(alice, squat(alice, 20), false); // 체력 126, 하체 200
        shadow.strike(alice, "LEGS", "MISS", false);
        shadow.strike(alice, "LEGS", "MISS", false);
        ShadowHitResponse kill = shadow.strike(alice, "LEGS", "MISS", false);
        assertThat(kill.killed()).isTrue();
        assertThat(kill.reward().titles()).containsExactlyInAnyOrder("그림자를 넘은 자", "그림자 사냥꾼");
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.streakWeeks()).isEqualTo(4);
        assertThat(s.passives()).containsExactly("그림자 사냥꾼");
        assertThat(ShadowRules.critMultiplier(1, true)).isEqualTo(1.61);
    }

    @Test
    void deletingSourceTakesUnspentChargeThenCutsLastHitAndKeepsKill() {
        WorkoutSession first = squat(alice, 6);
        shadow.onSession(alice, first, true); // 하체 60, 토큰 1
        WorkoutSession second = squat(alice, 6);
        shadow.onSession(alice, second, false); // 하체 120
        shadow.strike(alice, "LEGS", "MISS", false); // 60 들어감, 통 60 남음
        shadow.strike(alice, "LEGS", "MISS", false); // 처치(120 ≥ 100), 통 0
        assertThat(shadow.status(alice).killed()).isTrue();

        // 둘째 세션 삭제: 통엔 0 이라 전부 "이미 쓴 힘" → 마지막 타 60 을 깎는다. 처치는 유지
        shadow.onDeleted("SESSION", second.getId());
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.damage()).isEqualTo(60);
        assertThat(s.remaining()).isEqualTo(40);
        assertThat(s.hits()).hasSize(2);
        assertThat(s.hits().get(1).damage()).isZero();
        assertThat(s.hits().get(0).hpAfter()).isEqualTo(40);
        assertThat(s.killed()).isTrue();
        assertThat(s.critTokens()).isEqualTo(1);
        ShadowWeek row = thisWeek();
        assertThat(row.getKilledAt()).isNotNull();
        assertThat(row.isRewarded()).isTrue();

        // 첫 세션 삭제: 남은 타 60 도 깎이고, 안 쓴 토큰도 빠진다
        shadow.onDeleted("SESSION", first.getId());
        s = shadow.status(alice);
        assertThat(s.damage()).isZero();
        assertThat(s.critTokens()).isZero();
        assertThat(s.chargeTotal()).isZero();

        // 안 쓴 힘이 있으면 통에서 먼저 뺀다
        WorkoutSession third = squat(alice, 9); // 하체 90
        shadow.onSession(alice, third, false);
        shadow.strike(alice, "LEGS", "MISS", false); // 60 씀, 30 남음
        int before = shadow.status(alice).damage();
        shadow.onDeleted("SESSION", third.getId());
        s = shadow.status(alice);
        assertThat(s.charge().get("LEGS")).isZero();
        assertThat(s.damage()).isEqualTo(before - 60);

        shadow.onDeleted("SESSION", 999_999L); // 모르는 건 그냥 지나간다
    }

    @Test
    void legacyFirstVersionHitsAreStillDeletedBySource() {
        // 1차 때 저장된 공격 행(source SESSION, 세션 id 로 지움)
        ShadowWeek w = thisWeek_create();
        em.persist(com.ajou.muscleup.entity.ShadowHit.builder().week(w).user(alice).source("SESSION").sourceId(777L).hitOn(TODAY)
                .raw(60).damage(60).hpAfter(40).build());
        w.setDamage(60);
        w.setHits(1);
        em.flush();
        assertThat(shadow.status(alice).damage()).isEqualTo(60);
        shadow.onDeleted("SESSION", 777L);
        assertThat(shadow.status(alice).damage()).isZero();
        assertThat(shadow.status(alice).hits()).isEmpty();
    }

    private ShadowWeek thisWeek_create() {
        shadow.status(alice);
        return thisWeek();
    }

    @Test
    void restWeekAccumulatesDamageButNeverKillsAndKeepsStreak() {
        // 지난 4주: 처치 · 처치 · 휴식 · 처치 → 연속 3. 이번 주는 주간 목표의 휴식 주
        week(alice, WEEK.minusWeeks(1), 100, 120, true, false);
        week(alice, WEEK.minusWeeks(2), 100, 120, true, false);
        week(alice, WEEK.minusWeeks(3), 100, 0, false, true);
        week(alice, WEEK.minusWeeks(4), 100, 120, true, false);
        em.persist(WeeklyGoalWeek.builder().user(alice).weekStart(WEEK).target(3).rest(true).build());
        em.flush();

        shadow.onSession(alice, squat(alice, 15), false);
        shadow.strike(alice, "LEGS", "MISS", false);
        shadow.strike(alice, "LEGS", "MISS", false);
        ShadowHitResponse hit = shadow.strike(alice, "LEGS", "MISS", false);
        assertThat(hit.killed()).isFalse();
        assertThat(hit.reward()).isNull();

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.rest()).isTrue();
        assertThat(s.hp()).isEqualTo(126); // (120 × 3) / 3 × 1.05
        assertThat(s.damage()).isEqualTo(150);
        assertThat(s.killed()).isFalse();
        assertThat(s.streakWeeks()).isEqualTo(3);
        assertThat(profiles.findByUser(alice)).isEmpty();

        List<ShadowHistoryItem> history = shadow.history(alice, 8);
        assertThat(history).hasSize(5);
        assertThat(history.get(0).weekStart()).isEqualTo(WEEK);
        assertThat(history.get(0).rest()).isTrue();
        assertThat(history.get(1).killed()).isTrue();
        assertThat(history.get(3).rest()).isTrue();
        assertThat(history.get(3).killed()).isFalse();

        // 놓친 주(행은 있는데 못 잡음)에서 연속이 끊긴다. 행이 없는 주도 끊는다
        User bob = save("sb-bob@test.local");
        week(bob, WEEK.minusWeeks(1), 100, 120, true, false);
        week(bob, WEEK.minusWeeks(2), 100, 50, false, false);
        week(bob, WEEK.minusWeeks(3), 100, 120, true, false);
        assertThat(shadow.status(bob).streakWeeks()).isEqualTo(1);
        User carol = save("sb-carol@test.local");
        week(carol, WEEK.minusWeeks(2), 100, 120, true, false);
        assertThat(shadow.status(carol).streakWeeks()).isZero();
    }

    // ---------------- 정산 ----------------

    @Test
    void leftoverChargeIsSettledAsPlainAttacksWhenTheWeekIsOver() {
        // 지난 주: 하체 100 · 돌진 30 남기고 토큰 1 — 정산 전(settled=false)
        ShadowWeek last = ShadowWeek.builder().user(alice).weekStart(WEEK.minusWeeks(1)).hp(100).levelAtStart(1).settled(false)
                .chargeLegs(100).chargeRun(30).critTokens(1).build();
        em.persist(last);
        em.flush();

        // 상태를 보면 그 자리에서 정산된다: 큰 통(하체 100)에 토큰 → ×1.51 = 151, 돌진 30 → 합 181, 처치 · 보상
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.lastWeek()).isNotNull();
        assertThat(s.lastWeek().damage()).isEqualTo(181);
        assertThat(s.lastWeek().killed()).isTrue();
        assertThat(s.streakWeeks()).isEqualTo(1); // 지난주를 정산으로 잡았다(이번 주는 아직)
        assertThat(s.hp()).isEqualTo(190); // 181 × 1.05
        ShadowWeek row = weeks.findById(last.getId()).orElseThrow();
        assertThat(row.isSettled()).isTrue();
        assertThat(row.chargeTotal()).isZero();
        assertThat(row.getCritTokens()).isZero();
        assertThat(row.isRewarded()).isTrue();
        assertThat(profiles.findByUser(alice).orElseThrow().getAttendancePoints()).isEqualTo(10);
        List<com.ajou.muscleup.entity.ShadowHit> settled = hits.findAllByWeek_IdOrderByIdAsc(last.getId());
        assertThat(settled).hasSize(2);
        assertThat(settled.get(0).getSource()).isEqualTo("SETTLE");
        assertThat(settled.get(0).getSkill()).isEqualTo("LEGS");
        assertThat(settled.get(0).isCrit()).isTrue();
        assertThat(settled.get(0).getHitOn()).isEqualTo(WEEK.minusDays(1)); // 그 주 일요일
        assertThat(settled.get(1).getSkill()).isEqualTo("RUN");
        assertThat(settled.get(1).getGrade()).isNull();

        // 두 번 정산되지 않는다. 이번 주 행은 정산 전
        shadow.status(alice);
        assertThat(hits.findAllByWeek_IdOrderByIdAsc(last.getId())).hasSize(2);
        assertThat(thisWeek().isSettled()).isFalse();
    }

    @Test
    void schedulerSettlesEveryUnsettledPastWeekButNotThisWeek() {
        User bob = save("sb-bob@test.local");
        em.persist(ShadowWeek.builder().user(alice).weekStart(WEEK.minusWeeks(1)).hp(100).levelAtStart(1).settled(false).chargeChest(20).build());
        em.persist(ShadowWeek.builder().user(bob).weekStart(WEEK.minusWeeks(2)).hp(100).levelAtStart(1).settled(false).chargeArms(5).build());
        em.persist(ShadowWeek.builder().user(bob).weekStart(WEEK).hp(100).levelAtStart(1).settled(false).chargeLegs(60).build());
        em.flush();

        List<Long> ids = shadow.unsettledWeekIds();
        assertThat(ids).hasSize(2);
        for (Long id : ids) shadow.settleWeek(id);
        assertThat(shadow.unsettledWeekIds()).isEmpty();
        assertThat(weeks.findByUser_IdAndWeekStart(alice.getId(), WEEK.minusWeeks(1)).orElseThrow().getDamage()).isEqualTo(20);
        assertThat(weeks.findByUser_IdAndWeekStart(bob.getId(), WEEK.minusWeeks(2)).orElseThrow().getDamage()).isEqualTo(5);
        ShadowWeek bobNow = weeks.findByUser_IdAndWeekStart(bob.getId(), WEEK).orElseThrow();
        assertThat(bobNow.isSettled()).isFalse();
        assertThat(bobNow.getChargeLegs()).isEqualTo(60);
    }

    // ---------------- API ----------------

    @Test
    void apiEnterStrikeRunAndHistoryWithoutPersonalData() throws Exception {
        mvc.perform(get("/api/shadow").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("그림자"))
                .andExpect(jsonPath("$.weekStart").value("2026-10-12"))
                .andExpect(jsonPath("$.hp").value(100))
                .andExpect(jsonPath("$.charge.RUN").value(0))
                .andExpect(jsonPath("$.hits").isEmpty())
                .andExpect(jsonPath("$.lastWeek").doesNotExist())
                .andExpect(content().string(not(containsString("@test.local"))));

        // 러닝 5.2km → 돌진 통 52, 첫 러닝은 기록 갱신 → 토큰
        mvc.perform(post("/api/runs").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("""
                        {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:30:00Z","durationSec":1640,"distanceM":5200,
                         "splits":[330,320,310,300,305],"source":"GPS"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.records.length()").value(3))
                .andExpect(jsonPath("$.shadow").doesNotExist())
                .andExpect(jsonPath("$.shadowCharge.charged.RUN").value(52))
                .andExpect(jsonPath("$.shadowCharge.critToken").value(true))
                .andExpect(jsonPath("$.shadowCharge.chargeLeft.RUN").value(52));

        // 들어오면 횟수가 센다
        mvc.perform(post("/api/shadow/dungeon/enter").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chargeTotal").value(52))
                .andExpect(jsonPath("$.critTokens").value(1))
                .andExpect(content().string(not(containsString("@test.local"))));
        assertThat(thisWeek().getVisits()).isEqualTo(1);

        // 빈 통은 400 + 한국어 문구
        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skill\":\"LEGS\",\"grade\":\"PERFECT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("하체")));
        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skill\":\"RUN\",\"grade\":\"GOOD\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("DUNGEON"))
                .andExpect(jsonPath("$.skill").value("RUN"))
                .andExpect(jsonPath("$.grade").value("GOOD"))
                .andExpect(jsonPath("$.raw").value(52))
                .andExpect(jsonPath("$.damage").value(53))
                .andExpect(jsonPath("$.crit").value(false))
                .andExpect(jsonPath("$.hpAfter").value(47))
                .andExpect(jsonPath("$.mob").doesNotExist())
                .andExpect(jsonPath("$.chargeLeft.RUN").value(0))
                .andExpect(jsonPath("$.critTokensLeft").value(1));

        mvc.perform(get("/api/shadow/history?weeks=8").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].damage").value(53))
                .andExpect(jsonPath("$[0].killed").value(false))
                .andExpect(content().string(not(containsString("@test.local"))));

        mvc.perform(get("/api/shadow")).andExpect(status().is4xxClientError());
        mvc.perform(post("/api/shadow/dungeon/enter")).andExpect(status().is4xxClientError());
        mvc.perform(post("/api/shadow/dungeon/strike").contentType(MediaType.APPLICATION_JSON).content("{\"skill\":\"RUN\"}"))
                .andExpect(status().is4xxClientError());
    }

    // ---------------- 지도판 잡몹 (docs/design/shadow-dungeon-map.md) ----------------

    private ShadowMobView mobOf(ShadowStatusResponse s, String code) {
        return s.mobs().stream().filter(m -> m.code().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void weekGetsFourMobsScaledToBossHpWithAStableLineup() {
        week(alice, WEEK.minusWeeks(1), 400, 400, false, false); // 체력 420
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.hp()).isEqualTo(420);
        assertThat(s.mobs()).hasSize(4);
        assertThat(s.mobs()).extracting(ShadowMobView::code).containsExactlyInAnyOrder("TOMORROW", "MIDNIGHT_SNACK", "SNOOZE", "EXCUSE");
        assertThat(s.mobs()).extracting(ShadowMobView::slot).containsExactly(0, 1, 2, 3);
        assertThat(mobOf(s, "TOMORROW").hp()).isEqualTo(42); // 420 × 10%
        assertThat(mobOf(s, "MIDNIGHT_SNACK").hp()).isEqualTo(50); // × 12% = 50.4
        assertThat(mobOf(s, "EXCUSE").hp()).isEqualTo(59); // × 14% = 58.8
        assertThat(mobOf(s, "EXCUSE").shards()).isEqualTo(2);
        assertThat(mobOf(s, "SNOOZE").name()).isEqualTo("알람 스누즈");
        assertThat(s.mobs()).noneMatch(ShadowMobView::killed).noneMatch(ShadowMobView::rare);

        // 다시 봐도 새로 만들지 않고, 배치는 사용자 · 주 시드로 늘 같다
        assertThat(shadow.status(alice).mobs()).extracting(ShadowMobView::id).containsExactlyElementsOf(s.mobs().stream().map(ShadowMobView::id).toList());
        assertThat(ShadowRules.mobLineup(alice.getId(), WEEK, false)).extracting(ShadowRules.MobDef::code)
                .containsExactlyElementsOf(s.mobs().stream().map(ShadowMobView::code).toList());
        // 첫 주(체력 100) — 최소 15
        User bob = save("sb-bob@test.local");
        assertThat(shadow.status(bob).mobs()).allSatisfy(m -> assertThat(m.hp()).isEqualTo(15));
        assertThat(ShadowRules.mobHp(100, ShadowRules.EXCUSE)).isEqualTo(15);
    }

    @Test
    void bigOverkillLastWeekSpawnsTheRareSofa() {
        week(alice, WEEK.minusWeeks(1), 100, 160, true, false); // 오버킬 60%
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.mobs()).hasSize(5);
        ShadowMobView sofa = mobOf(s, "SOFA");
        assertThat(sofa.rare()).isTrue();
        assertThat(sofa.slot()).isEqualTo(4);
        assertThat(sofa.name()).isEqualTo("소파 괴물");
        assertThat(sofa.shards()).isEqualTo(5);

        User bob = save("sb-bob@test.local");
        week(bob, WEEK.minusWeeks(1), 100, 140, true, false); // 오버킬 40% — 희귀 없음
        assertThat(shadow.status(bob).mobs()).hasSize(4);
    }

    @Test
    void strikingAMobUsesOnlyWhatItNeedsAndRefundsTheRest() {
        week(alice, WEEK.minusWeeks(1), 400, 400, false, false); // 체력 420, 내일부터 42
        shadow.onSession(alice, squat(alice, 10), false); // 하체 100
        Long tomorrow = mobOf(shadow.status(alice), "TOMORROW").id();

        // 60 을 꺼냈지만 42 면 충분 → 42 만 쓰고 18 은 통으로, 오버킬 없음
        ShadowHitResponse hit = shadow.strike(alice, String.valueOf(tomorrow), "LEGS", "MISS", false);
        assertThat(hit.source()).isEqualTo("MOB");
        assertThat(hit.hp()).isEqualTo(42);
        assertThat(hit.raw()).isEqualTo(42);
        assertThat(hit.damage()).isEqualTo(42);
        assertThat(hit.hpBefore()).isEqualTo(42);
        assertThat(hit.hpAfter()).isZero();
        assertThat(hit.killed()).isTrue();
        assertThat(hit.overkillPct()).isZero();
        assertThat(hit.reward()).isNull();
        assertThat(hit.mob().code()).isEqualTo("TOMORROW");
        assertThat(hit.mob().name()).isEqualTo("내일부터");
        assertThat(hit.mob().refunded()).isEqualTo(18);
        assertThat(hit.mob().shards()).isEqualTo(1);
        assertThat(hit.mob().firstKill()).isTrue();
        assertThat(hit.chargeLeft().get("LEGS")).isEqualTo(58);

        // 보스 합계 · 공격 목록에는 섞이지 않는다. 잡몹에 쓴 힘은 따로 센다
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.damage()).isZero();
        assertThat(s.hits()).isEmpty();
        assertThat(mobOf(s, "TOMORROW").killed()).isTrue();
        assertThat(mobOf(s, "TOMORROW").remaining()).isZero();
        assertThat(thisWeek().getMobForce()).isEqualTo(42);
        assertThat(wallets.findByUser_Id(alice.getId()).orElseThrow().getShards()).isEqualTo(1);

        // 보너스가 있으면 더 적게 쓴다: 야식 슬라임 50, PERFECT 5% → round(f × 1.05) ≥ 50 인 최소 f = 48
        Long snack = mobOf(s, "MIDNIGHT_SNACK").id();
        ShadowHitResponse perfect = shadow.strike(alice, String.valueOf(snack), "LEGS", "PERFECT", false);
        assertThat(perfect.raw()).isEqualTo(48);
        assertThat(perfect.damage()).isEqualTo(50);
        assertThat(perfect.mob().refunded()).isEqualTo(10);
        assertThat(ShadowRules.neededForce(60, 50, 5, false, 1.5)).isEqualTo(48);

        // 힘이 모자라면 깎이기만 하고 남는다(조각 없음)
        Long excuse = mobOf(shadow.status(alice), "EXCUSE").id(); // 59
        ShadowHitResponse partial = shadow.strike(alice, String.valueOf(excuse), "LEGS", "MISS", false); // 남은 10
        assertThat(partial.raw()).isEqualTo(10);
        assertThat(partial.hpAfter()).isEqualTo(49);
        assertThat(partial.killed()).isFalse();
        assertThat(partial.mob().shards()).isZero();
        assertThat(partial.mob().refunded()).isZero();
        assertThat(mobOf(shadow.status(alice), "EXCUSE").remaining()).isEqualTo(49);
    }

    @Test
    void mobTargetsAreCheckedAndFirstKillIsPerKind() {
        shadow.onSession(alice, squat(alice, 20), false); // 하체 200, 잡몹 체력 전부 15
        ShadowStatusResponse s = shadow.status(alice);
        Long tomorrow = mobOf(s, "TOMORROW").id();
        assertThat(shadow.strike(alice, String.valueOf(tomorrow), "LEGS", "MISS", false).killed()).isTrue();

        // 이미 쓰러짐 · 모르는 id · 남의 것 · 이상한 값
        assertThatThrownBy(() -> shadow.strike(alice, String.valueOf(tomorrow), "LEGS", "MISS", false)).hasMessageContaining("이미 쓰러진");
        assertThatThrownBy(() -> shadow.strike(alice, "999999", "LEGS", "MISS", false)).hasMessageContaining("찾을 수 없어요");
        User bob = save("sb-bob@test.local");
        Long bobs = mobOf(shadow.status(bob), "SNOOZE").id();
        assertThatThrownBy(() -> shadow.strike(alice, String.valueOf(bobs), "LEGS", "MISS", false)).hasMessageContaining("찾을 수 없어요");
        assertThatThrownBy(() -> shadow.strike(alice, "dragon", "LEGS", "MISS", false)).hasMessageContaining("모르는 상대");
        // 통이 비었으면 잡몹도 못 친다
        assertThatThrownBy(() -> shadow.strike(alice, String.valueOf(mobOf(s, "SNOOZE").id()), "CHEST", "MISS", false)).hasMessageContaining("가슴");

        // 지난주에 같은 종류를 잡았으면 첫 처치가 아니다(도감 카드는 한 번)
        User carol = save("sb-carol@test.local");
        ShadowWeek last = week(carol, WEEK.minusWeeks(1), 100, 0, false, false);
        em.persist(ShadowMob.builder().week(last).user(carol).code("SNOOZE").slot(0).hp(15).damage(15).killedAt(WEEK.minusDays(2).atTime(9, 0)).build());
        em.flush();
        shadow.onSession(carol, squat(carol, 6), false);
        ShadowStatusResponse cs = shadow.status(carol);
        ShadowHitResponse again = shadow.strike(carol, String.valueOf(mobOf(cs, "SNOOZE").id()), "LEGS", "MISS", false);
        assertThat(again.killed()).isTrue();
        assertThat(again.mob().firstKill()).isFalse();
        ShadowHitResponse fresh = shadow.strike(carol, String.valueOf(mobOf(cs, "TOMORROW").id()), "LEGS", "MISS", false);
        assertThat(fresh.mob().firstKill()).isTrue();
        // 지난주 잡몹은 칠 수 없다
        Long lastWeekMob = mobs.findAllByWeek_IdOrderBySlotAsc(last.getId()).get(0).getId();
        assertThatThrownBy(() -> shadow.strike(carol, String.valueOf(lastWeekMob), "LEGS", "MISS", false)).hasMessageContaining("지난주");
    }

    @Test
    void mobSpendingAndBossDamageBothCountTowardNextWeeksHp() {
        ShadowWeek last = week(alice, WEEK.minusWeeks(1), 100, 200, true, false);
        last.setMobForce(100);
        em.flush();
        // 지난주: 보스 200 + 잡몹 100 = 300 → 이번 주 체력 315
        assertThat(shadow.status(alice).hp()).isEqualTo(315);
    }

    @Test
    void apiEnterListsMobsAndStrikeTakesATarget() throws Exception {
        shadow.onSession(alice, squat(alice, 6), false); // 하체 60, 잡몹 15
        String body = mvc.perform(post("/api/shadow/dungeon/enter").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mobs.length()").value(4))
                .andExpect(jsonPath("$.mobs[0].hp").value(15))
                .andExpect(jsonPath("$.mobs[0].killed").value(false))
                .andExpect(content().string(not(containsString("@test.local"))))
                .andReturn().getResponse().getContentAsString();
        Integer mobId = JsonPath.read(body, "$.mobs[0].id");
        String code = JsonPath.read(body, "$.mobs[0].code");

        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"target\":\"" + mobId + "\",\"skill\":\"LEGS\",\"grade\":\"MISS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("MOB"))
                .andExpect(jsonPath("$.raw").value(15))
                .andExpect(jsonPath("$.killed").value(true))
                .andExpect(jsonPath("$.mob.code").value(code))
                .andExpect(jsonPath("$.mob.refunded").value(45))
                .andExpect(jsonPath("$.mob.firstKill").value(true))
                .andExpect(jsonPath("$.chargeLeft.LEGS").value(45));
        // BOSS 는 이름으로도
        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"target\":\"BOSS\",\"skill\":\"LEGS\",\"grade\":\"MISS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("DUNGEON"))
                .andExpect(jsonPath("$.raw").value(45));
        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"target\":\"" + mobId + "\",\"skill\":\"LEGS\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/shadow/dungeon/strike").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"target\":\"424242\",\"skill\":\"LEGS\"}"))
                .andExpect(status().isNotFound());
    }
}
