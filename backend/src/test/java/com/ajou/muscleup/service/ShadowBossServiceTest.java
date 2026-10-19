package com.ajou.muscleup.service;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.dto.shadow.ShadowHistoryItem;
import com.ajou.muscleup.dto.shadow.ShadowHitResponse;
import com.ajou.muscleup.dto.shadow.ShadowStatusResponse;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.RunSession;
import com.ajou.muscleup.entity.ShadowWeek;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WeeklyGoalWeek;
import com.ajou.muscleup.entity.WorkoutSession;
import com.ajou.muscleup.entity.WorkoutSet;
import com.ajou.muscleup.repository.CharacterProfileRepository;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 주간 보스 "그림자"(docs/design/shadow-boss.md 7절 "PR 1 테스트"). 오늘을 2026-10-15(목) 12:00 KST 로 고정 — 이번 주는 10-12(월)~10-18(일).
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

    /** 저장된 운동 세션(검증을 거치지 않고 바로 표에) — 종목 코드와 횟수만 그림자가 본다 */
    private WorkoutSession session(User u, double totalVolume, String exercise, double weight, int reps, int sets) {
        WorkoutSession s = WorkoutSession.builder().user(u).performedOn(TODAY).startedAt(TODAY.atTime(10, 0)).endedAt(TODAY.atTime(11, 0))
                .durationSec(3600).totalVolume(totalVolume).totalSets(sets).build();
        for (int i = 0; i < sets; i++) {
            s.getSets().add(WorkoutSet.builder().session(s).exercise(exercise).exerciseOrder(0).setOrder(i).weightKg(weight).reps(reps).build());
        }
        em.persist(s);
        em.flush();
        return s;
    }

    private WorkoutSession squat(User u, double totalVolume) {
        return session(u, totalVolume, "SQUAT", 100, 10, 1);
    }

    private ShadowWeek week(User u, LocalDate weekStart, int hp, int damage, boolean killed, boolean rest) {
        ShadowWeek w = ShadowWeek.builder().user(u).weekStart(weekStart).hp(hp).damage(damage).hits(damage > 0 ? 1 : 0).levelAtStart(1)
                .killedAt(killed ? weekStart.atTime(20, 0) : null).rewarded(killed).rest(rest).build();
        em.persist(w);
        em.flush();
        return w;
    }

    @Test
    void firstWeekHasHp100AndNothingElse() {
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
        // 상태를 본 것만으로 이번 주 행이 생긴다(스케줄러 없음)
        assertThat(weeks.findByUser_IdAndWeekStart(alice.getId(), WEEK)).isPresent();
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

    @Test
    void sessionForceIsVolumeOver100AndBodyweightCounts20kgPerRep() {
        // 볼륨 6,000kg → 힘 60
        ShadowHitResponse hit = shadow.onSession(alice, squat(alice, 6000), false);
        assertThat(hit.source()).isEqualTo("SESSION");
        assertThat(hit.raw()).isEqualTo(60);
        assertThat(hit.damage()).isEqualTo(60);
        assertThat(hit.crit()).isFalse();
        assertThat(hit.hpBefore()).isEqualTo(100);
        assertThat(hit.hpAfter()).isEqualTo(40);
        assertThat(hit.killed()).isFalse();
        assertThat(hit.reward()).isNull();

        // 맨몸 턱걸이 8회 3세트: 무게 0 이라 볼륨 0 → 24회 × 20kg = 480kg → 4.8 → 5
        ShadowHitResponse pullUps = shadow.onSession(alice, session(alice, 0, "PULL_UP", 0, 8, 3), false);
        assertThat(pullUps.raw()).isEqualTo(5);
        assertThat(pullUps.hpBefore()).isEqualTo(40);
        assertThat(pullUps.hpAfter()).isEqualTo(35);

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.damage()).isEqualTo(65);
        assertThat(s.remaining()).isEqualTo(35);
        assertThat(s.hits()).hasSize(2);
        assertThat(s.hits().get(0).hpAfter()).isEqualTo(40);
        assertThat(s.hits().get(1).hpAfter()).isEqualTo(35);

        assertThat(ShadowRules.sessionForce(6000, 0)).isEqualTo(60);
        assertThat(ShadowRules.sessionForce(0, 24)).isEqualTo(5);
        assertThat(ShadowRules.runForce(5000)).isEqualTo(50);
    }

    @Test
    void forceBelowOneIsNotAnAttack() {
        RunSession tiny = RunSession.builder().user(alice).performedOn(TODAY).startedAt(TODAY.atTime(10, 0)).endedAt(TODAY.atTime(10, 2))
                .durationSec(120).distanceM(40).source("GPS").build();
        em.persist(tiny);
        em.flush();
        assertThat(shadow.onRun(alice, tiny, false)).isNull();
        assertThat(shadow.onSession(alice, squat(alice, 30), false)).isNull();
        assertThat(shadow.status(alice).hits()).isEmpty();
    }

    @Test
    void dailyCapIs300AndThirdSessionDealsNothing() {
        week(alice, WEEK.minusWeeks(1), 100, 1000, true, false); // 체력 1,050 — 처치가 끼어들지 않게
        assertThat(shadow.onSession(alice, squat(alice, 15000), false).damage()).isEqualTo(150);
        assertThat(shadow.onSession(alice, squat(alice, 15000), false).damage()).isEqualTo(150);
        ShadowHitResponse third = shadow.onSession(alice, squat(alice, 10000), false);
        assertThat(third.raw()).isEqualTo(100);
        assertThat(third.damage()).isZero();
        assertThat(third.crit()).isFalse();

        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.hp()).isEqualTo(1050);
        assertThat(s.damage()).isEqualTo(300);
        assertThat(s.hits()).hasSize(3);

        assertThat(ShadowRules.capped(100, 250)).isEqualTo(50);
        assertThat(ShadowRules.capped(100, 300)).isZero();
    }

    @Test
    void recordMakesOneCritScaledByLevel() {
        // Lv20 → ×1.7. 레벨은 주가 시작될 때 값으로 고정
        profiles.save(CharacterProfile.builder().user(alice).level(20).tier(CharacterTier.BRONZE).evolutionStage(0).title("리프터")
                .isPublic(false).attendancePoints(0).build());
        week(alice, WEEK.minusWeeks(1), 100, 1000, true, false);
        ShadowHitResponse hit = shadow.onSession(alice, squat(alice, 6000), true);
        assertThat(hit.crit()).isTrue();
        assertThat(hit.raw()).isEqualTo(60);
        assertThat(hit.damage()).isEqualTo(102); // round(60 × 1.7)
        assertThat(shadow.status(alice).level()).isEqualTo(20);
        assertThat(ShadowRules.critMultiplier(20)).isEqualTo(1.7);
        assertThat(ShadowRules.damage(60, true, 1)).isEqualTo(91); // Lv1 ×1.51
    }

    @Test
    void sessionWithThreePrsCritsOnlyOnceAndDeleteRemovesTheHit() throws Exception {
        // 첫 세션이라 스쿼트 · 벤치 · 데드 세 종목 모두 개인 최고(PR 3개) → 치명타는 한 번(×1.51, Lv1)
        // 볼륨 = 100×5×2 + 60×5×2 + 120×5×2 = 2,800 → 힘 28 → round(28 × 1.51) = 42
        String body = mvc.perform(post("/api/workouts").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("""
                        {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:52:00Z",
                         "exercises":[
                           {"exercise":"SQUAT","sets":[{"weightKg":100,"reps":5},{"weightKg":100,"reps":5}]},
                           {"exercise":"BENCH","sets":[{"weightKg":60,"reps":5},{"weightKg":60,"reps":5}]},
                           {"exercise":"DEADLIFT","sets":[{"weightKg":120,"reps":5},{"weightKg":120,"reps":5}]}
                         ]}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.prs.length()").value(3))
                .andExpect(jsonPath("$.shadow.source").value("SESSION"))
                .andExpect(jsonPath("$.shadow.raw").value(28))
                .andExpect(jsonPath("$.shadow.crit").value(true))
                .andExpect(jsonPath("$.shadow.damage").value(42))
                .andExpect(jsonPath("$.shadow.hpBefore").value(100))
                .andExpect(jsonPath("$.shadow.hpAfter").value(58))
                .andExpect(jsonPath("$.shadow.killed").value(false))
                .andExpect(jsonPath("$.shadow.reward").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        Integer id = JsonPath.read(body, "$.session.summary.id");

        mvc.perform(get("/api/shadow").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.damage").value(42))
                .andExpect(jsonPath("$.hits.length()").value(1))
                .andExpect(jsonPath("$.hits[0].crit").value(true));

        // 세션을 지우면 공격도 사라지고 합계를 다시 더한다
        mvc.perform(delete("/api/workouts/" + id).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/shadow").with(as(alice)))
                .andExpect(jsonPath("$.damage").value(0))
                .andExpect(jsonPath("$.remaining").value(100))
                .andExpect(jsonPath("$.hits.length()").value(0));
    }

    @Test
    void killRewardsOncePerWeekThenOnlyOverkill() {
        shadow.onSession(alice, squat(alice, 6000), false);
        ShadowHitResponse kill = shadow.onSession(alice, squat(alice, 6000), false);
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

        // 같은 주 세 번째 공격: 오버킬만, 보상 없음
        ShadowHitResponse more = shadow.onSession(alice, squat(alice, 6000), false);
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
        ShadowWeek row = weeks.findByUser_IdAndWeekStart(alice.getId(), WEEK).orElseThrow();
        assertThat(row.isRewarded()).isTrue();
        assertThat(row.getHits()).isEqualTo(3);
    }

    @Test
    void fourKillsInARowUnlockHunterTitle() {
        week(alice, WEEK.minusWeeks(1), 100, 120, true, false);
        week(alice, WEEK.minusWeeks(2), 100, 120, true, false);
        week(alice, WEEK.minusWeeks(3), 100, 120, true, false);
        ShadowHitResponse kill = shadow.onSession(alice, squat(alice, 20000), false); // 체력 126 → 한 번에
        assertThat(kill.killed()).isTrue();
        assertThat(kill.reward().titles()).containsExactlyInAnyOrder("그림자를 넘은 자", "그림자 사냥꾼");
        assertThat(shadow.status(alice).streakWeeks()).isEqualTo(4);
    }

    @Test
    void deletingSourceRecountsButKeepsKill() {
        WorkoutSession first = squat(alice, 6000);
        shadow.onSession(alice, first, false);
        WorkoutSession second = squat(alice, 6000);
        assertThat(shadow.onSession(alice, second, false).killed()).isTrue();

        shadow.onDeleted("SESSION", second.getId());
        ShadowStatusResponse s = shadow.status(alice);
        assertThat(s.damage()).isEqualTo(60);
        assertThat(s.remaining()).isEqualTo(40);
        assertThat(s.hits()).hasSize(1);
        assertThat(s.hits().get(0).hpAfter()).isEqualTo(40);
        assertThat(s.killed()).isTrue(); // 처치는 되돌리지 않는다
        ShadowWeek row = weeks.findByUser_IdAndWeekStart(alice.getId(), WEEK).orElseThrow();
        assertThat(row.getKilledAt()).isNotNull();
        assertThat(row.isRewarded()).isTrue();
        assertThat(row.getHits()).isEqualTo(1);

        shadow.onDeleted("SESSION", 999_999L); // 모르는 건 그냥 지나간다
        assertThat(shadow.status(alice).hits()).hasSize(1);
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

        ShadowHitResponse hit = shadow.onSession(alice, squat(alice, 15000), false);
        assertThat(hit.damage()).isEqualTo(150);
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

    @Test
    void apiStatusHistoryAndRunAttackWithoutPersonalData() throws Exception {
        mvc.perform(get("/api/shadow").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("그림자"))
                .andExpect(jsonPath("$.weekStart").value("2026-10-12"))
                .andExpect(jsonPath("$.weekEnd").value("2026-10-18"))
                .andExpect(jsonPath("$.hp").value(100))
                .andExpect(jsonPath("$.remaining").value(100))
                .andExpect(jsonPath("$.hits").isEmpty())
                .andExpect(jsonPath("$.lastWeek").doesNotExist())
                .andExpect(content().string(not(containsString("@test.local"))));

        // 러닝 5.2km → 힘 52, 첫 러닝은 기록 갱신 → 치명타 ×1.51 = 79
        mvc.perform(post("/api/runs").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("""
                        {"startedAt":"2026-10-15T01:00:00Z","endedAt":"2026-10-15T01:30:00Z","durationSec":1640,"distanceM":5200,
                         "splits":[330,320,310,300,305],"source":"GPS"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.records.length()").value(3))
                .andExpect(jsonPath("$.shadow.source").value("RUN"))
                .andExpect(jsonPath("$.shadow.raw").value(52))
                .andExpect(jsonPath("$.shadow.crit").value(true))
                .andExpect(jsonPath("$.shadow.damage").value(79))
                .andExpect(jsonPath("$.shadow.hpAfter").value(21));

        mvc.perform(get("/api/shadow/history?weeks=8").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].weekStart").value("2026-10-12"))
                .andExpect(jsonPath("$[0].damage").value(79))
                .andExpect(jsonPath("$[0].killed").value(false))
                .andExpect(content().string(not(containsString("@test.local"))));

        mvc.perform(get("/api/shadow")).andExpect(status().is4xxClientError());
        mvc.perform(get("/api/shadow/history")).andExpect(status().is4xxClientError());
    }
}
