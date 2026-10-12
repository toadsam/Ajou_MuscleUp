package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원 탈퇴(0단계 PR 8). 개인정보 처리방침(docs/legal/privacy-draft.md §2)의 "탈퇴하면 바로 지워요"를 지키는 곳.
 *
 * - 지우는 것: 로그인 연결 · 로그인 유지 토큰 · 신체 정보 · 식단 기록/목표 · 캐릭터 · 출석 · AI 상담 · 자랑방 글/댓글/좋아요 · 친구 · 1:1 채팅방 ·
 *   모임 가입/신청 · 공동구매 참여/메시지 · 후기 · 이벤트 참여 · 화면 이용/접속 기록 · 문의 · 프로그램 신청 · 이메일 인증 기록 · 신고/차단.
 * - 남기는 것: 사용자 행 자체(다른 사람과 같이 쓰는 기록의 연결이 깨지지 않게)를 "탈퇴한 회원"으로 익명화.
 *   이메일은 내부용 주소로 바꿔 같은 이메일 · 소셜 계정으로 다시 가입하면 새 계정이 된다.
 *   내가 연 공동구매 글은 참여자 기록 때문에 남기고(작성자 = 탈퇴한 회원), 모임장이던 모임은 운영진(없으면 가장 오래된 멤버)에게 넘긴다.
 *   멤버가 없는 모임은 보관(ARCHIVED).
 * - 올린 파일(사진 · 영상) 자체는 아직 저장소에서 지우지 않는다(남은 일, fix-log).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {
    public static final String DELETED_NICKNAME = "탈퇴한 회원";
    public static final String DELETED_ROLE = "ROLE_DELETED";

    private final UserRepository userRepository;
    private final UserService userService;
    private final WorkoutCrewMemberRepository memberRepository;
    private final Clock clock;

    @PersistenceContext
    private EntityManager em;

    @Transactional
    public void delete(User user) {
        Long id = user.getId();
        String email = user.getEmail();
        boolean realEmail = user.hasRealEmail();

        handOverGyms(user);
        // 아래는 모두 일괄 삭제(쿼리)라 메모리의 엔티티와 어긋날 수 있다 → 먼저 쓰고, 끝나면 비운 뒤 사용자를 다시 읽는다
        em.flush();

        // 내 자랑방 글: 남이 단 댓글 · 좋아요, 사진 목록(brag_media)부터 지운다
        exec("delete from BragComment c where c.bragPost.user.id = :id", id);
        exec("delete from BragLike l where l.bragPost.user.id = :id", id);
        List<Long> postIds = em.createQuery("select p.id from BragPost p where p.user.id = :id", Long.class)
                .setParameter("id", id).getResultList();
        if (!postIds.isEmpty()) {
            em.createNativeQuery("delete from brag_media where brag_id in (:ids)").setParameter("ids", postIds).executeUpdate();
        }
        exec("delete from BragPost p where p.user.id = :id", id);
        exec("delete from BragComment c where c.user.id = :id", id);
        exec("delete from BragLike l where l.user.id = :id", id);

        // 출석 · 캐릭터 · 신체 정보 · AI · 식단
        exec("delete from AttendanceShareReport r where r.attendanceLog.user.id = :id or r.user.id = :id", id);
        exec("delete from AttendanceLog a where a.user.id = :id", id);
        exec("delete from WeeklyGoalWeek w where w.user.id = :id", id);
        exec("delete from WeeklyGoalSetting s where s.user.id = :id", id);
        exec("delete from DailyQuest q where q.user.id = :id", id);
        exec("delete from LiftEntry l where l.user.id = :id", id);
        exec("delete from CustomExercise c where c.user.id = :id", id);
        exec("delete from WorkoutSet x where x.session.user.id = :id", id);
        exec("delete from WorkoutSession s where s.user.id = :id", id);
        exec("delete from RunSession r where r.user.id = :id", id);
        exec("delete from UserCollectionItem i where i.user.id = :id", id);
        exec("delete from UserCollection c where c.user.id = :id", id);
        exec("delete from PushLog l where l.user.id = :id", id);
        exec("delete from PushSubscription s where s.user.id = :id", id);
        exec("delete from PushPreference p where p.user.id = :id", id);
        exec("delete from CharacterEvolutionHistory h where h.user.id = :id", id);
        exec("delete from CharacterProfile c where c.user.id = :id", id);
        exec("delete from UserBodyStats s where s.user.id = :id", id);
        exec("delete from AiChatMessage m where m.user.id = :id", id);
        exec("delete from EventParticipant p where p.user.id = :id", id);
        exec("delete from MealEntry m where m.user.id = :id", id);
        exec("delete from DietGoal g where g.user.id = :id", id);

        // 친구 · 1:1 채팅(상대 쪽 대화 기록도 함께 사라진다 — 방침 §2 에 맞춤)
        exec("delete from FriendChatMessage m where m.room.userLow.id = :id or m.room.userHigh.id = :id", id);
        exec("delete from FriendChatRoom r where r.userLow.id = :id or r.userHigh.id = :id", id);
        exec("delete from Friendship f where f.userLow.id = :id or f.userHigh.id = :id", id);
        exec("delete from FriendRequest r where r.requester.id = :id or r.receiver.id = :id", id);

        // 모임 · 공동구매 · 후기
        exec("delete from WorkoutCrewJoinRequest r where r.user.id = :id", id);
        exec("delete from WorkoutCrewMember m where m.user.id = :id", id);
        exec("delete from ProteinShareMessage m where m.user.id = :id", id);
        exec("delete from ProteinShareApplication a where a.user.id = :id", id);
        exec("delete from Review r where r.user.id = :id", id);

        // 신고 · 차단(내가 한 것 · 나를 대상으로 한 것)
        exec("delete from UserBlock b where b.blocker.id = :id or b.blocked.id = :id", id);
        exec("delete from ContentReport r where r.reporter.id = :id", id);

        // 로그인 · 기록
        exec("delete from SocialAccount s where s.user.id = :id", id);
        exec("delete from RefreshToken t where t.user.id = :id", id);
        exec("delete from AnalyticsEvent e where e.user.id = :id", id);
        exec("delete from AuditLog l where l.user.id = :id", id);
        exec("delete from LoungeVisitLog l where l.user.id = :id", id);
        exec("delete from Inquiry q where q.userId = :id", id);
        if (email != null && realEmail) {
            execEmail("delete from Inquiry q where lower(q.email) = lower(:email)", email);
            execEmail("delete from ProgramApplication a where lower(a.email) = lower(:email)", email);
            execEmail("delete from EmailVerification v where lower(v.email) = lower(:email)", email);
        }

        // 사용자 행 익명화
        em.clear();
        user = userRepository.findById(id).orElseThrow();
        user.setEmail("deleted-" + id + "@" + SocialLoginService.PLACEHOLDER_DOMAIN);
        user.setEmailPlaceholder(Boolean.TRUE);
        user.setName(DELETED_NICKNAME);
        user.setNickname(DELETED_NICKNAME);
        user.setRole(DELETED_ROLE);
        user.setPassword(userService.encodePassword("deleted-" + UUID.randomUUID()));
        user.setDeletedAt(LocalDateTime.now(clock));
        userRepository.save(user);
        log.info("회원 탈퇴 처리: userId={}", id);
    }

    /** 모임장이던 모임: 운영진 → 가장 오래된 멤버 순으로 넘기고, 남은 멤버가 없으면 보관한다 */
    private void handOverGyms(User user) {
        List<WorkoutCrew> owned = em.createQuery("select g from WorkoutCrew g where g.owner.id = :id", WorkoutCrew.class)
                .setParameter("id", user.getId()).getResultList();
        for (WorkoutCrew gym : owned) {
            WorkoutCrewMember next = memberRepository.findAllByCrewOrderByCreatedAtAsc(gym).stream()
                    .filter(m -> !Objects.equals(m.getUser().getId(), user.getId()))
                    .min(Comparator.comparing((WorkoutCrewMember m) -> m.getRole() == WorkoutCrewMemberRole.STAFF ? 0 : 1))
                    .orElse(null);
            if (next == null) {
                gym.setStatus(GymStatus.ARCHIVED);
                log.info("탈퇴로 모임 보관: gymId={}", gym.getId());
            } else {
                gym.setOwner(next.getUser());
                next.setRole(WorkoutCrewMemberRole.OWNER);
                log.info("탈퇴로 모임장 넘김: gymId={} newOwnerId={}", gym.getId(), next.getUser().getId());
            }
        }
    }

    private void exec(String jpql, Long id) {
        em.createQuery(jpql).setParameter("id", id).executeUpdate();
    }

    private void execEmail(String jpql, String email) {
        em.createQuery(jpql).setParameter("email", email).executeUpdate();
    }
}
