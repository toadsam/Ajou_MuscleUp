package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.DailyQuest;
import com.ajou.muscleup.entity.MealEntry;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.DailyQuestRepository;
import com.ajou.muscleup.repository.MealEntryRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 오늘 할 일 3개(출석 · 식단 1끼 · 다른 사람 응원 1번)와 활동 점수.
 * - 출석은 원래 출석 점수가 있으니 여기서 더 주지 않는다. 식단 +3, 응원 +2, 세 개 다 +5, 단백질 목표 달성 +5(하루 한 번씩).
 * - 점수는 출석 점수와 같은 곳(CharacterProfile.attendancePoints)에 쌓이고, 활동 레벨(ActivityLevel)로 보인다.
 * - 날짜는 한국 시간 "오늘"만. 지난 날 식단을 적어도 할 일은 채워지지 않는다.
 * - 응원 = 자랑방 좋아요 · 댓글, 출석 공유글 응원(로그인). 내 글은 빼고.
 *
 * 행(daily_quests)은 홈에서 할 일을 불러올 때 미리 만들어 두고, 행동이 오면 잠그고 읽는다(보너스 두 번 방지).
 * 홈을 거치지 않은 첫 행동 두 개가 거의 동시에 오면 행 만들기가 겹칠 수 있다(드묾 — 출석은 다시 시도로 처리됨).
 */
@Service
@RequiredArgsConstructor
public class DailyQuestService {
    public static final int DIET_POINTS = 3;
    public static final int CHEER_POINTS = 2;
    public static final int ALL_POINTS = 5;
    public static final int PROTEIN_POINTS = 5;

    private final DailyQuestRepository questRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final MealEntryRepository mealEntryRepository;
    private final CharacterProfileRepository profileRepository;
    private final UserRepository userRepository;
    private final DietService dietService;
    private final CharacterGrowthService characterGrowthService;
    private final Clock clock;

    public record Item(String id, String label, boolean done, int points) {}

    /** goalG 가 null 이면 단백질 목표가 없다(몸무게도 없음) */
    public record Protein(Integer goalG, double eatenG, boolean done, boolean rewarded, int points) {}

    public record Today(LocalDate date, List<Item> items, boolean allDone, boolean allRewarded, int allPoints,
                        Protein protein, ActivityLevel activity) {}

    @Transactional
    public Today today(User me) {
        LocalDate today = LocalDate.now(clock);
        DailyQuest q = questRepository.findByUser_IdAndQuestDate(me.getId(), today)
                .orElseGet(() -> questRepository.save(DailyQuest.builder().user(me).questDate(today).build()));
        // 홈을 열기 전에 이미 한 일(지난 배포 전 식단 등)도 여기서 채워 준다
        int gained = settle(me, q, today);
        if (gained > 0) {
            characterGrowthService.applyAttendance(me, gained);
        }
        return view(me, q, today);
    }

    @EventListener
    @Transactional
    public void on(ActivityEvent event) {
        LocalDate today = LocalDate.now(clock);
        if (event.date() == null || !event.date().equals(today)) {
            return;
        }
        User me = userRepository.findById(event.userId()).orElse(null);
        if (me == null) {
            return;
        }
        DailyQuest q = questRepository.findForUpdate(me.getId(), today)
                .orElseGet(() -> questRepository.save(DailyQuest.builder().user(me).questDate(today).build()));
        if (event.kind() == ActivityEvent.Kind.CHEER) {
            q.setCheerDone(true);
        }
        int gained = settle(me, q, today);
        questRepository.save(q);
        if (gained > 0) {
            characterGrowthService.applyAttendance(me, gained);
        }
    }

    /** 아직 안 준 보너스를 정해 표시하고, 이번에 생긴 점수를 돌려준다 */
    private int settle(User me, DailyQuest q, LocalDate today) {
        boolean attendance = attendanceLogRepository.findByUserAndDate(me, today).isPresent();
        boolean diet = mealEntryRepository.countByUser_IdAndEatenOn(me.getId(), today) > 0;
        int gained = 0;
        if (diet && !q.isDietRewarded()) {
            q.setDietRewarded(true);
            gained += DIET_POINTS;
        }
        if (q.isCheerDone() && !q.isCheerRewarded()) {
            q.setCheerRewarded(true);
            gained += CHEER_POINTS;
        }
        if (attendance && diet && q.isCheerDone() && !q.isAllRewarded()) {
            q.setAllRewarded(true);
            gained += ALL_POINTS;
        }
        Protein p = protein(me, q, today);
        if (p.done() && !q.isProteinRewarded()) {
            q.setProteinRewarded(true);
            gained += PROTEIN_POINTS;
        }
        return gained;
    }

    private Protein protein(User me, DailyQuest q, LocalDate today) {
        DietService.GoalView goal = dietService.goal(me);
        Integer goalG = goal == null ? null : goal.proteinG();
        double eaten = 0;
        for (MealEntry e : mealEntryRepository.findAllByUser_IdAndEatenOnOrderByCreatedAtAsc(me.getId(), today)) {
            if (e.getProteinG() != null) eaten += e.getProteinG();
        }
        eaten = Math.round(eaten * 10) / 10.0;
        boolean done = goalG != null && goalG > 0 && eaten >= goalG;
        return new Protein(goalG, eaten, done, q.isProteinRewarded(), PROTEIN_POINTS);
    }

    private Today view(User me, DailyQuest q, LocalDate today) {
        boolean attendance = attendanceLogRepository.findByUserAndDate(me, today).isPresent();
        boolean diet = mealEntryRepository.countByUser_IdAndEatenOn(me.getId(), today) > 0;
        List<Item> items = List.of(
                new Item("attendance", "출석 체크", attendance, 0),
                new Item("diet", "식단 1끼 기록", diet, DIET_POINTS),
                new Item("cheer", "다른 사람 응원 1번", q.isCheerDone(), CHEER_POINTS));
        int points = profileRepository.findByUser(me).map(CharacterProfile::getAttendancePoints).orElse(0);
        return new Today(today, items, attendance && diet && q.isCheerDone(), q.isAllRewarded(), ALL_POINTS,
                protein(me, q, today), ActivityLevel.of(points));
    }
}
