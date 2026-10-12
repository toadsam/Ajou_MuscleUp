package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserCollection;
import com.ajou.muscleup.entity.UserCollectionItem;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.RunSessionRepository;
import com.ajou.muscleup.repository.UserCollectionItemRepository;
import com.ajou.muscleup.repository.UserCollectionRepository;
import com.ajou.muscleup.repository.WorkoutSessionRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 도감(모으는 재미) + 보상 상자(의외의 보상).
 * - 상자: 주간 목표를 채우면 하나(확정), 그 밖의 운동 출석 날엔 20% 확률로 "행운 상자"(하루 한 번 굴림), 도감에 처음 오면 하나.
 * - 상자를 열면 등급(보통 60 · 희귀 28 · 영웅 10 · 전설 2)을 고르고 그 등급의 상자 아이템 하나. 이미 있으면 조각.
 * - 조각을 모아 아직 없는 상자 아이템을 만들 수 있다.
 * - 업적 아이템(칭호)은 조건을 채우면 생긴다 — 출석할 때와 도감을 열 때 확인한다.
 * - 장착: 칭호 · 민소매 색 · 카드 테두리 하나씩. 지금은 내 화면(캐릭터 카드 · 홈)에서만 보인다.
 */
@Service
@RequiredArgsConstructor
public class CollectionService {
    static final int LUCKY_PERCENT = 20;
    private static final LocalDate EPOCH = LocalDate.of(2000, 1, 1);

    private final UserCollectionRepository walletRepository;
    private final UserCollectionItemRepository itemRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final RunSessionRepository runSessionRepository;
    private final CharacterProfileRepository characterProfileRepository;
    private final WeeklyGoalService weeklyGoalService;
    private final RewardRandom random;
    private final Clock clock;

    public record ItemView(String code, String category, String rarity, String label, String value, boolean fromBox,
                           String hint, Integer progress, Integer goal, boolean owned, boolean isNew,
                           LocalDateTime acquiredAt, Integer craftCost) {}

    public record Equipped(String titleCode, String title, String tankCode, String tank, String frameCode, String frame) {}

    public record View(int boxes, int shards, int boxesOpened, int owned, int total, Equipped equipped,
                       ActivityLevel activity, List<ItemView> items, List<String> newlyUnlocked, boolean welcomeBox) {}

    public record Summary(int boxes, int owned, int total, Equipped equipped, ActivityLevel activity) {}

    public record OpenResult(ItemView item, boolean duplicate, int shardsGained, int boxes, int shards) {}

    /** 출석 응답에 붙는 것. box: WEEKLY_GOAL · LUCKY · null, unlocked: 새로 얻은 업적 이름들 */
    public record AttendanceReward(String box, List<String> unlocked) {
        public boolean isEmpty() {
            return box == null && unlocked.isEmpty();
        }
    }

    @Transactional
    public View view(User me) {
        UserCollection wallet = lockedWallet(me);
        boolean welcome = false;
        if (!wallet.isWelcomeGiven()) {
            wallet.setWelcomeGiven(true);
            wallet.setBoxes(wallet.getBoxes() + 1);
            welcome = true;
        }
        Counters counters = new Counters(me);
        List<String> unlocked = unlockAchievements(me, counters);
        List<UserCollectionItem> owned = itemRepository.findAllByUser_Id(me.getId());
        Map<String, UserCollectionItem> byCode = new HashMap<>();
        owned.forEach(i -> byCode.put(i.getItemCode(), i));
        List<ItemView> items = new ArrayList<>();
        for (CollectionItem item : CollectionItem.values()) {
            items.add(itemView(item, byCode.get(item.name()), counters));
        }
        // 한 번 보여 줬으면 "새로 얻음" 표시를 끈다
        owned.stream().filter(i -> !i.isSeen()).forEach(i -> i.setSeen(true));
        return new View(wallet.getBoxes(), wallet.getShards(), wallet.getBoxesOpened(), byCode.size(), CollectionItem.values().length,
                equipped(wallet), counters.activity(), items, unlocked, welcome);
    }

    /** 홈 · 마이페이지용 — 만들거나 바꾸지 않는다(처음이면 도감에서 받을 상자 하나를 미리 세어 보여 준다) */
    @Transactional(readOnly = true)
    public Summary summary(User me) {
        UserCollection wallet = walletRepository.findByUser_Id(me.getId()).orElse(null);
        int boxes = wallet == null ? 1 : wallet.getBoxes() + (wallet.isWelcomeGiven() ? 0 : 1);
        int owned = itemRepository.findAllByUser_Id(me.getId()).size();
        return new Summary(boxes, owned, CollectionItem.values().length,
                wallet == null ? new Equipped(null, null, null, null, null, null) : equipped(wallet),
                new Counters(me).activity());
    }

    @Transactional
    public OpenResult open(User me) {
        UserCollection wallet = lockedWallet(me);
        if (!wallet.isWelcomeGiven()) {
            wallet.setWelcomeGiven(true);
            wallet.setBoxes(wallet.getBoxes() + 1);
        }
        if (wallet.getBoxes() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "열 상자가 없어요. 운동하고 주간 목표를 채우면 생겨요.");
        }
        wallet.setBoxes(wallet.getBoxes() - 1);
        wallet.setBoxesOpened(wallet.getBoxesOpened() + 1);

        CollectionItem.Rarity rarity = rollRarity();
        List<CollectionItem> pool = CollectionItem.boxItems(rarity);
        CollectionItem item = pool.get(random.nextInt(pool.size()));
        boolean duplicate = itemRepository.existsByUser_IdAndItemCode(me.getId(), item.name());
        UserCollectionItem row = null;
        int shards = 0;
        if (duplicate) {
            shards = rarity.duplicateShards;
            wallet.setShards(wallet.getShards() + shards);
        } else {
            row = itemRepository.save(UserCollectionItem.builder().user(me).itemCode(item.name()).source("BOX")
                    .acquiredAt(LocalDateTime.now(clock)).seen(true).build());
        }
        return new OpenResult(itemView(item, row, null), duplicate, shards, wallet.getBoxes(), wallet.getShards());
    }

    @Transactional
    public ItemView craft(User me, String code) {
        CollectionItem item = CollectionItem.parse(code);
        if (item == null || !item.fromBox()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "조각으로 만들 수 없는 거예요.");
        }
        UserCollection wallet = lockedWallet(me);
        if (itemRepository.existsByUser_IdAndItemCode(me.getId(), item.name())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 가지고 있어요.");
        }
        if (wallet.getShards() < item.rarity.craftCost) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "조각이 모자라요(" + item.rarity.craftCost + "개 필요).");
        }
        wallet.setShards(wallet.getShards() - item.rarity.craftCost);
        UserCollectionItem row = itemRepository.save(UserCollectionItem.builder().user(me).itemCode(item.name()).source("CRAFT")
                .acquiredAt(LocalDateTime.now(clock)).seen(true).build());
        return itemView(item, row, null);
    }

    /** code 가 null 이면 그 칸을 비운다 */
    @Transactional
    public Equipped equip(User me, String category, String code) {
        CollectionItem.Category cat;
        try {
            cat = CollectionItem.Category.valueOf(category == null ? "" : category.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "칸을 알 수 없어요.");
        }
        UserCollection wallet = lockedWallet(me);
        String value = null;
        if (code != null && !code.isBlank()) {
            CollectionItem item = CollectionItem.parse(code);
            if (item == null || item.category != cat) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 칸에 낄 수 없는 거예요.");
            }
            if (!itemRepository.existsByUser_IdAndItemCode(me.getId(), item.name())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아직 모으지 못한 거예요.");
            }
            value = item.name();
        }
        switch (cat) {
            case TITLE -> wallet.setEquippedTitle(value);
            case TANK -> wallet.setEquippedTank(value);
            case FRAME -> wallet.setEquippedFrame(value);
        }
        return equipped(wallet);
    }

    /**
     * 출석이 "운동 안 함 → 운동함"으로 바뀐 뒤(같은 트랜잭션, 점수 반영 뒤) 부른다.
     * 주간 목표를 막 채웠으면 상자 확정, 아니면 오늘 첫 번째로 굴릴 때 20% 행운 상자. 그리고 업적 확인.
     */
    @Transactional
    public AttendanceReward onWorkoutDay(User me, LocalDate date, boolean weeklyGoalAchieved) {
        UserCollection wallet = lockedWallet(me);
        LocalDate today = LocalDate.now(clock);
        String box = null;
        if (weeklyGoalAchieved) {
            wallet.setBoxes(wallet.getBoxes() + 1);
            box = "WEEKLY_GOAL";
        } else if (date.equals(today) && !today.equals(wallet.getLastLuckyDate())) {
            wallet.setLastLuckyDate(today);
            if (random.nextInt(100) < LUCKY_PERCENT) {
                wallet.setBoxes(wallet.getBoxes() + 1);
                box = "LUCKY";
            }
        }
        return new AttendanceReward(box, unlockAchievements(me, new Counters(me)));
    }

    private CollectionItem.Rarity rollRarity() {
        int r = random.nextInt(100);
        int acc = 0;
        for (CollectionItem.Rarity rarity : CollectionItem.Rarity.values()) {
            acc += rarity.weight;
            if (r < acc) return rarity;
        }
        return CollectionItem.Rarity.COMMON;
    }

    /** 조건을 채운 업적 아이템을 새로 준다 → 새로 얻은 이름들 */
    private List<String> unlockAchievements(User me, Counters counters) {
        List<String> unlocked = new ArrayList<>();
        java.util.Set<String> owned = new java.util.HashSet<>();
        itemRepository.findAllByUser_Id(me.getId()).forEach(i -> owned.add(i.getItemCode()));
        for (CollectionItem item : CollectionItem.values()) {
            if (item.fromBox() || owned.contains(item.name())) continue;
            if (counters.progress(item.achievement) >= item.achievement.goal) {
                itemRepository.save(UserCollectionItem.builder().user(me).itemCode(item.name()).source("ACHIEVEMENT")
                        .acquiredAt(LocalDateTime.now(clock)).seen(false).build());
                unlocked.add(item.label);
            }
        }
        return unlocked;
    }

    private ItemView itemView(CollectionItem item, UserCollectionItem row, Counters counters) {
        Integer progress = null;
        Integer goal = null;
        if (!item.fromBox()) {
            goal = item.achievement.goal;
            if (counters != null) progress = Math.min(goal, counters.progress(item.achievement));
        }
        return new ItemView(item.name(), item.category.name(), item.rarity.name(), item.label, item.value, item.fromBox(),
                item.fromBox() ? "보상 상자" : item.achievement.hint, progress, goal, row != null, row != null && !row.isSeen(),
                row == null ? null : row.getAcquiredAt(), item.fromBox() ? item.rarity.craftCost : null);
    }

    private static Equipped equipped(UserCollection w) {
        CollectionItem t = CollectionItem.parse(w.getEquippedTitle());
        CollectionItem k = CollectionItem.parse(w.getEquippedTank());
        CollectionItem f = CollectionItem.parse(w.getEquippedFrame());
        return new Equipped(t == null ? null : t.name(), t == null ? null : t.value,
                k == null ? null : k.name(), k == null ? null : k.value,
                f == null ? null : f.name(), f == null ? null : f.value);
    }

    private UserCollection lockedWallet(User me) {
        return walletRepository.findForUpdate(me.getId())
                .orElseGet(() -> walletRepository.saveAndFlush(UserCollection.builder().user(me).build()));
    }

    /** 업적 진행도 — 필요한 것만 한 번씩 센다 */
    private final class Counters {
        private final User me;
        private final Map<CollectionItem.Achievement, Integer> cache = new EnumMap<>(CollectionItem.Achievement.class);
        private Integer attendance;
        private Integer streak;
        private ActivityLevel activity;

        Counters(User me) {
            this.me = me;
        }

        int progress(CollectionItem.Achievement a) {
            return cache.computeIfAbsent(a, this::compute);
        }

        private int compute(CollectionItem.Achievement a) {
            return switch (a) {
                case ATTENDANCE_1, ATTENDANCE_30, ATTENDANCE_100 -> attendance();
                case WEEKLY_STREAK_4, WEEKLY_STREAK_12 -> streak();
                case SESSION_10 -> (int) workoutSessionRepository.countByUser_Id(me.getId());
                case RUN_1 -> (int) runSessionRepository.countByUser_Id(me.getId());
                case RUN_42K -> (int) runSessionRepository.sumDistanceByUserId(me.getId());
                case ACTIVITY_10, ACTIVITY_25 -> activity().level();
            };
        }

        private int attendance() {
            if (attendance == null) {
                attendance = (int) attendanceLogRepository.countByUserAndDidWorkoutTrueAndDateBetween(me, EPOCH, LocalDate.now(clock));
            }
            return attendance;
        }

        private int streak() {
            if (streak == null) streak = weeklyGoalService.status(me).streakWeeks();
            return streak;
        }

        ActivityLevel activity() {
            if (activity == null) {
                int points = characterProfileRepository.findByUser(me).map(CharacterProfile::getAttendancePoints).orElse(0);
                activity = ActivityLevel.of(points);
            }
            return activity;
        }
    }
}
