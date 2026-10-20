package com.ajou.muscleup.service;

import com.ajou.muscleup.config.TimeConfig;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.entity.UserCollection;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다른 사람에게도 보이는 "겉모습" — 도감에서 장착한 민소매 색 · 칭호, 운동 직후 펌핑, 몸 단계(BodyStage 0~5).
 * 친구 목록 · 모임 · 라운지 입장권 · 내 캐릭터 응답이 같이 쓴다. 여러 명은 한 번에 읽는다(사람마다 쿼리하지 않게).
 * 이메일 같은 개인정보는 담지 않는다.
 */
@Service
@RequiredArgsConstructor
public class AvatarLookService {
    /** 운동 세션을 끝낸 뒤 이 시간 동안 근육이 한 단계 커 보인다 */
    public static final Duration PUMP = Duration.ofHours(1);

    private final EntityManager em;
    private final Clock clock;
    private final CharacterGrowthCalculator growthCalculator;

    /**
     * tank: "#RRGGBB" 또는 null, title: 장착한 칭호 글자 또는 null, pumpedUntil: 펌핑이 끝나는 시각(epoch ms) 또는 null,
     * bodyStage: 몸 단계 0~5(근육량 · 캐릭터 레벨 · 활동 레벨 중 가장 높은 것, 펌핑 전)
     */
    public record Look(String tank, String title, Long pumpedUntil, int bodyStage) {
        static final Look EMPTY = new Look(null, null, null, 0);

        public boolean pumped(long nowMs) {
            return pumpedUntil != null && pumpedUntil > nowMs;
        }
    }

    @Transactional(readOnly = true)
    public Look look(Long userId) {
        return looks(List.of(userId)).getOrDefault(userId, Look.EMPTY);
    }

    @Transactional(readOnly = true)
    public Map<Long, Look> looks(Collection<Long> userIds) {
        Map<Long, Look> out = new HashMap<>();
        if (userIds == null || userIds.isEmpty()) return out;
        Map<Long, String[]> worn = new HashMap<>();
        em.createQuery("select c from UserCollection c where c.user.id in :ids", UserCollection.class)
                .setParameter("ids", userIds).getResultList()
                .forEach(c -> worn.put(c.getUser().getId(), new String[]{value(c.getEquippedTank()), value(c.getEquippedTitle())}));
        Map<Long, Long> pump = new HashMap<>();
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime since = now.minus(PUMP);
        em.createQuery("select s.user.id, max(s.endedAt) from WorkoutSession s where s.user.id in :ids and s.endedAt > :since "
                        + "and s.endedAt <= :now group by s.user.id", Object[].class)
                .setParameter("ids", userIds).setParameter("since", since).setParameter("now", now)
                .getResultList()
                .forEach(r -> pump.put((Long) r[0], ((LocalDateTime) r[1]).plus(PUMP).atZone(TimeConfig.KST).toInstant().toEpochMilli()));
        Map<Long, Integer> stages = bodyStages(userIds);
        for (Long id : userIds) {
            String[] w = worn.get(id);
            Long p = pump.get(id);
            int stage = stages.getOrDefault(id, 0);
            if (w == null && p == null && stage == 0) continue;
            out.put(id, new Look(w == null ? null : w[0], w == null ? null : w[1], p, stage));
        }
        return out;
    }

    /** 몸 단계: 캐릭터(레벨 · 활동 점수)와 체성분(근육량)을 한 번씩 읽는다 */
    private Map<Long, Integer> bodyStages(Collection<Long> userIds) {
        Map<Long, double[]> muscle = new HashMap<>();
        em.createQuery("select s from UserBodyStats s where s.user.id in :ids", UserBodyStats.class)
                .setParameter("ids", userIds).getResultList()
                .forEach(s -> muscle.put(s.getUser().getId(), new double[]{growthCalculator.calculate(s).getMuscularityNormalized()}));
        Map<Long, Integer> out = new HashMap<>();
        em.createQuery("select p from CharacterProfile p where p.user.id in :ids", CharacterProfile.class)
                .setParameter("ids", userIds).getResultList()
                .forEach(p -> {
                    Long id = p.getUser().getId();
                    double m = muscle.containsKey(id) ? muscle.get(id)[0] : 0;
                    out.put(id, BodyStage.of(m, p.getLevel(), ActivityLevel.of(p.getAttendancePoints()).level()));
                });
        return out;
    }

    private static String value(String code) {
        CollectionItem item = CollectionItem.parse(code);
        return item == null ? null : item.value;
    }
}
