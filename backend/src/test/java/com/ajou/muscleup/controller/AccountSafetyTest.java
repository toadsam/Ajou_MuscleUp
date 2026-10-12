package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.BragComment;
import com.ajou.muscleup.entity.BragLike;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.BragVisibility;
import com.ajou.muscleup.entity.FriendChatMessage;
import com.ajou.muscleup.entity.FriendChatRoom;
import com.ajou.muscleup.entity.Friendship;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.SocialAccount;
import com.ajou.muscleup.entity.SocialProvider;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.BragCommentRepository;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 탈퇴 · 신고 · 차단(0단계 PR 8, docs/legal/*-draft.md).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccountSafetyTest {

    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired UserRepository users;
    @Autowired WorkoutCrewRepository gyms;
    @Autowired WorkoutCrewMemberRepository members;
    @Autowired BragPostRepository posts;
    @Autowired BragCommentRepository comments;
    @Autowired BragLikeRepository likes;

    private User alice;
    private User bob;
    private User admin;

    @BeforeEach
    void setUp() {
        alice = save("as-alice@test.local", "ROLE_USER");
        bob = save("as-bob@test.local", "ROLE_USER");
        admin = save("as-admin@test.local", "ROLE_ADMIN");
    }

    private User save(String email, String role) {
        return users.save(User.builder().name(email).email(email).password("x").role(role)
                .nickname(email.substring(0, 8)).createdAt(LocalDateTime.now()).build());
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority(u.getRole()))));
    }

    private BragPost brag(User author, String title) {
        BragPost p = BragPost.builder().user(author).title(title).content("본문").mediaUrls(new java.util.ArrayList<>(List.of("/m.png")))
                .visibility(BragVisibility.PUBLIC).build();
        return posts.save(p);
    }

    private long count(String jpql, Long id) {
        return em.createQuery(jpql, Long.class).setParameter("id", id).getSingleResult();
    }

    @Test
    void withdrawRemovesPersonalDataAndHandsOverGyms() throws Exception {
        // 앨리스의 흔적: 글(밥의 댓글 · 좋아요 달림) · 밥 글에 단 댓글 · 좋아요 · 친구 · 채팅 · 소셜 연결 · 모임장 두 곳
        BragPost alicePost = brag(alice, "앨리스 글");
        BragPost bobPost = brag(bob, "밥 글");
        comments.save(BragComment.builder().bragPost(alicePost).user(bob).content("멋져요").build());
        likes.save(BragLike.builder().bragPost(alicePost).user(bob).build());
        comments.save(BragComment.builder().bragPost(bobPost).user(alice).content("저도요").build());
        likes.save(BragLike.builder().bragPost(bobPost).user(alice).build());
        User low = alice.getId() < bob.getId() ? alice : bob;
        User high = low == alice ? bob : alice;
        em.persist(Friendship.builder().userLow(low).userHigh(high).build());
        FriendChatRoom room = FriendChatRoom.builder().userLow(low).userHigh(high).build();
        em.persist(room);
        em.persist(FriendChatMessage.builder().room(room).sender(alice).content("안녕").build());
        em.persist(SocialAccount.builder().user(alice).provider(SocialProvider.GOOGLE).providerUserId("g-as-alice").build());
        WorkoutCrew shared = gyms.save(WorkoutCrew.builder().name("같이 쓰는 모임").owner(alice).inviteCode("ASGYM001").type(GymType.CREW)
                .slug("as-shared").status(GymStatus.ACTIVE).features(EnumSet.allOf(GymFeature.class)).build());
        members.save(WorkoutCrewMember.builder().crew(shared).user(alice).role(WorkoutCrewMemberRole.OWNER).build());
        members.save(WorkoutCrewMember.builder().crew(shared).user(bob).role(WorkoutCrewMemberRole.STAFF).build());
        WorkoutCrew solo = gyms.save(WorkoutCrew.builder().name("혼자 모임").owner(alice).inviteCode("ASGYM002").type(GymType.CREW)
                .slug("as-solo").status(GymStatus.ACTIVE).features(EnumSet.allOf(GymFeature.class)).build());
        members.save(WorkoutCrewMember.builder().crew(solo).user(alice).role(WorkoutCrewMemberRole.OWNER).build());
        em.persist(com.ajou.muscleup.entity.MealEntry.builder().user(alice).eatenOn(java.time.LocalDate.now())
                .mealType(com.ajou.muscleup.entity.MealType.LUNCH).name("닭가슴살").kcal(165).build());
        em.persist(com.ajou.muscleup.entity.DietGoal.builder().user(alice).proteinG(120).build());
        em.persist(com.ajou.muscleup.entity.WeeklyGoalSetting.builder().user(alice).target(4).build());
        em.persist(com.ajou.muscleup.entity.DailyQuest.builder().user(alice).questDate(java.time.LocalDate.now()).cheerDone(true).build());
        em.persist(com.ajou.muscleup.entity.LiftEntry.builder().user(alice).performedOn(java.time.LocalDate.now()).exercise("SQUAT").weightKg(100).reps(5).sets(3).e1rm(116.7).build());
        em.persist(com.ajou.muscleup.entity.WorkoutSession.builder().user(alice).performedOn(java.time.LocalDate.now())
                .startedAt(java.time.LocalDateTime.now().minusHours(1)).endedAt(java.time.LocalDateTime.now()).durationSec(3600).totalVolume(500).totalSets(1).build());
        em.persist(com.ajou.muscleup.entity.RunSession.builder().user(alice).performedOn(java.time.LocalDate.now())
                .startedAt(java.time.LocalDateTime.now().minusHours(1)).endedAt(java.time.LocalDateTime.now()).durationSec(1800).distanceM(5000).source("GPS").build());
        em.persist(com.ajou.muscleup.entity.WeeklyGoalWeek.builder().user(alice).weekStart(java.time.LocalDate.now()).target(4).build());
        em.flush();

        // 확인 문구 없으면 거절
        mvc.perform(post("/api/auth/withdraw").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/withdraw").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"confirm\":\"탈퇴\"}"))
                .andExpect(status().isOk())
                .andExpect(header().stringValues("Set-Cookie", org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.startsWith("refreshToken=;"))));
        em.flush();
        em.clear();

        Long id = alice.getId();
        User gone = users.findById(id).orElseThrow();
        assertThat(gone.getNickname()).isEqualTo("탈퇴한 회원");
        assertThat(gone.getEmail()).isEqualTo("deleted-" + id + "@users.musclehub.invalid");
        assertThat(gone.getRole()).isEqualTo("ROLE_DELETED");
        assertThat(gone.isDeleted()).isTrue();
        assertThat(users.findByEmail("as-alice@test.local")).isEmpty();

        assertThat(count("select count(p) from BragPost p where p.user.id = :id", id)).isZero();
        assertThat(count("select count(c) from BragComment c where c.user.id = :id", id)).isZero();
        assertThat(count("select count(l) from BragLike l where l.user.id = :id", id)).isZero();
        assertThat(count("select count(f) from Friendship f where f.userLow.id = :id or f.userHigh.id = :id", id)).isZero();
        assertThat(count("select count(m) from FriendChatMessage m where m.sender.id = :id", id)).isZero();
        assertThat(count("select count(s) from SocialAccount s where s.user.id = :id", id)).isZero();
        assertThat(count("select count(m) from WorkoutCrewMember m where m.user.id = :id", id)).isZero();
        assertThat(count("select count(m) from MealEntry m where m.user.id = :id", id)).isZero();
        assertThat(count("select count(g) from DietGoal g where g.user.id = :id", id)).isZero();
        assertThat(count("select count(w) from WeeklyGoalWeek w where w.user.id = :id", id)).isZero();
        assertThat(count("select count(s) from WeeklyGoalSetting s where s.user.id = :id", id)).isZero();
        assertThat(count("select count(q) from DailyQuest q where q.user.id = :id", id)).isZero();
        assertThat(count("select count(l) from LiftEntry l where l.user.id = :id", id)).isZero();
        assertThat(count("select count(s) from WorkoutSession s where s.user.id = :id", id)).isZero();
        assertThat(count("select count(r) from RunSession r where r.user.id = :id", id)).isZero();
        // 밥의 글은 남는다
        assertThat(posts.findById(bobPost.getId())).isPresent();

        // 모임장 넘김: 운영진이던 밥이 모임장, 혼자였던 모임은 보관
        WorkoutCrew sharedAfter = gyms.findBySlug("as-shared").orElseThrow();
        assertThat(sharedAfter.getOwner().getId()).isEqualTo(bob.getId());
        assertThat(members.findByCrewAndUser(sharedAfter, users.findById(bob.getId()).orElseThrow()).orElseThrow().getRole())
                .isEqualTo(WorkoutCrewMemberRole.OWNER);
        assertThat(gyms.findBySlug("as-solo").orElseThrow().statusOrDefault()).isEqualTo(GymStatus.ARCHIVED);
    }

    @Test
    void reportOnceThenAdminActsOnIt() throws Exception {
        BragPost bobPost = brag(bob, "광고글");
        BragPost alicePost = brag(alice, "내 글");
        String body = "{\"targetType\":\"BRAG_POST\",\"targetId\":" + bobPost.getId() + ",\"reason\":\"SPAM\",\"detail\":\"광고예요\"}";

        mvc.perform(post("/api/reports").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/reports").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/reports").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"BRAG_POST\",\"targetId\":" + alicePost.getId() + ",\"reason\":\"SPAM\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/reports").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"BRAG_POST\",\"targetId\":999999999,\"reason\":\"SPAM\"}"))
                .andExpect(status().isNotFound());

        // 일반 사용자는 운영자 목록을 못 봄
        mvc.perform(get("/api/admin/reports").with(as(alice))).andExpect(status().isForbidden());
        String list = mvc.perform(get("/api/admin/reports?status=OPEN&size=50").with(as(admin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> ids = JsonPath.read(list, "$.content[?(@.targetId == " + bobPost.getId() + ")].id");
        assertThat(ids).hasSize(1);
        assertThat((List<String>) JsonPath.read(list, "$.content[?(@.targetId == " + bobPost.getId() + ")].snapshot"))
                .first().asString().contains("광고글");

        mvc.perform(patch("/api/admin/reports/" + ids.get(0)).with(as(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACTIONED\",\"deleteContent\":true,\"note\":\"광고 삭제\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIONED"));
        em.flush();
        em.clear();
        assertThat(posts.findById(bobPost.getId())).isEmpty();
    }

    @Test
    void blockHidesEachOtherAndCutsFriendship() throws Exception {
        BragPost bobPost = brag(bob, "밥 자랑");
        BragPost alicePost = brag(alice, "앨리스 자랑");
        comments.save(BragComment.builder().bragPost(alicePost).user(bob).content("밥 댓글").build());
        User low = alice.getId() < bob.getId() ? alice : bob;
        User high = low == alice ? bob : alice;
        em.persist(Friendship.builder().userLow(low).userHigh(high).build());
        em.flush();

        mvc.perform(post("/api/blocks").with(as(alice)).contentType(MediaType.APPLICATION_JSON).content("{\"userId\":" + bob.getId() + "}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/blocks").with(as(alice))).andExpect(jsonPath("$[0].userId").value(bob.getId()));

        // 서로의 글이 피드 · 상세에서 안 보이고, 앨리스 글의 밥 댓글도 안 보임
        mvc.perform(get("/api/brags?size=30").with(as(alice)))
                .andExpect(jsonPath("$.content[?(@.id == " + bobPost.getId() + ")]").isEmpty());
        mvc.perform(get("/api/brags?size=30").with(as(bob)))
                .andExpect(jsonPath("$.content[?(@.id == " + alicePost.getId() + ")]").isEmpty());
        mvc.perform(get("/api/brags/" + bobPost.getId()).with(as(alice))).andExpect(status().isForbidden());
        mvc.perform(get("/api/brags/" + alicePost.getId() + "/comments").with(as(alice)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        // 응답에 이메일이 없다
        mvc.perform(get("/api/brags/" + alicePost.getId()).with(as(alice)))
                .andExpect(jsonPath("$.authorEmail").doesNotExist())
                .andExpect(jsonPath("$.mine").value(true));

        // 친구가 끊기고 친구 요청도 못 보냄
        assertThat(count("select count(f) from Friendship f where f.userLow.id = :id or f.userHigh.id = :id", alice.getId())).isZero();
        mvc.perform(post("/api/friends/requests").with(as(bob)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetUserId\":" + alice.getId() + "}"))
                .andExpect(status().isNotFound());

        // 풀면 다시 보인다
        mvc.perform(delete("/api/blocks/" + bob.getId()).with(as(alice))).andExpect(status().isNoContent());
        mvc.perform(get("/api/brags?size=30").with(as(alice)))
                .andExpect(jsonPath("$.content[?(@.id == " + bobPost.getId() + ")]").isNotEmpty());
    }
}
