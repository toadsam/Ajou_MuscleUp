package com.ajou.muscleup.scheduler;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.push.PushService;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.AttendanceService;
import com.ajou.muscleup.service.WeeklyGoalService;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 정해진 시각 알림(한국 시간). 알림을 켠 사람만, PushService 규칙(하루 2개 · 종류별 끄기 · 조용한 시간)을 그대로 따른다.
 * - 매일 19:00 출석 알림: 오늘 아직 출석 안 했으면. 연속 기록이 있으면 "끊기기 전에", 주간 목표가 남았으면 그 얘기.
 * - 토 · 일 18:00 주간 목표: 이번 주 목표가 남았고 남은 날에 아직 채울 수 있으면(오늘 출석했으면 안 보냄).
 * - 매일 04:20 30일 지난 보낸 기록 지우기.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushScheduler {
    private final PushService pushService;
    private final UserRepository userRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final AttendanceService attendanceService;
    private final WeeklyGoalService weeklyGoalService;
    private final Clock clock;

    @Scheduled(cron = "0 0 19 * * *", zone = "Asia/Seoul")
    public void dailyReminder() {
        int sent = 0;
        for (Long id : pushService.subscribedUserIds()) {
            try {
                sent += remindOne(id) ? 1 : 0;
            } catch (RuntimeException e) {
                log.info("[push] 출석 알림 실패(user {}): {}", id, e.getClass().getSimpleName());
            }
        }
        log.info("[push] 출석 알림 {}명", sent);
    }

    @Scheduled(cron = "0 0 18 * * SAT,SUN", zone = "Asia/Seoul")
    public void weeklyNudge() {
        int sent = 0;
        for (Long id : pushService.subscribedUserIds()) {
            try {
                sent += weeklyOne(id) ? 1 : 0;
            } catch (RuntimeException e) {
                log.info("[push] 주간 목표 알림 실패(user {}): {}", id, e.getClass().getSimpleName());
            }
        }
        log.info("[push] 주간 목표 알림 {}명", sent);
    }

    @Scheduled(cron = "0 20 4 * * *", zone = "Asia/Seoul")
    public void cleanup() {
        pushService.cleanupLogs();
    }

    public boolean remindOne(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        LocalDate today = LocalDate.now(clock);
        if (user == null || attendanceLogRepository.findByUserAndDate(user, today).isPresent()) return false;
        Integer s = attendanceService.getSummary(user.getEmail(), YearMonth.from(today)).getCurrentStreak();
        int streak = s == null ? 0 : s;
        WeeklyGoalService.Status week = weeklyGoalService.status(user);
        int left = week.target() - week.done();
        PushService.Message m;
        if (streak >= 2) {
            m = new PushService.Message("연속 " + streak + "일째, 오늘도 이어 가요", "오늘 운동을 기록하면 연속 기록이 이어져요.", "/attendance", "reminder");
        } else if (!week.achieved() && !week.rest() && left > 0) {
            m = new PushService.Message("이번 주 목표까지 " + left + "번", "오늘 운동하고 출석하면 한 걸음 더 가까워져요.", "/attendance", "reminder");
        } else {
            m = new PushService.Message("오늘 운동했나요?", "출석하면 캐릭터가 자라요. 쉬는 날이면 휴식도 기록할 수 있어요.", "/attendance", "reminder");
        }
        return pushService.send(userId, PushService.Type.REMINDER, m) > 0;
    }

    public boolean weeklyOne(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        LocalDate today = LocalDate.now(clock);
        if (user == null || attendanceLogRepository.findByUserAndDate(user, today).isPresent()) return false;
        WeeklyGoalService.Status week = weeklyGoalService.status(user);
        int left = week.target() - week.done();
        int daysLeft = DayOfWeek.SUNDAY.getValue() - today.getDayOfWeek().getValue() + 1; // 오늘 포함
        if (week.achieved() || week.rest() || left <= 0 || left > daysLeft) return false;
        return pushService.send(userId, PushService.Type.WEEKLY,
                new PushService.Message("이번 주 목표까지 " + left + "번 남았어요", "채우면 보상 상자가 확정이에요!", "/attendance", "weekly")) > 0;
    }
}
