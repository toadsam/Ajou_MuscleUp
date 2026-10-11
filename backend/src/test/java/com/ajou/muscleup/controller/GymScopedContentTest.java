package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.entity.CmsEvent;
import com.ajou.muscleup.entity.CmsEventStatus;
import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.EventStatus;
import com.ajou.muscleup.entity.GymFeature;
import com.ajou.muscleup.entity.GymStatus;
import com.ajou.muscleup.entity.GymType;
import com.ajou.muscleup.entity.GymVisibility;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.repository.CmsEventRepository;
import com.ajou.muscleup.repository.EventRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.repository.WorkoutCrewMemberRepository;
import com.ajou.muscleup.repository.WorkoutCrewRepository;
import com.ajou.muscleup.service.EventService;
import com.jayway.jsonpath.JsonPath;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 짐(모임)별 소식 · 출석 이벤트 · 자랑방(0단계 PR 6-2, docs/design/stage0-gyms.md §2):
 * 광장은 앱 전체 + 공개 모임 것, 모임을 고르면 그 모임 것. 비공개 모임 것과 "우리 모임만" 글은 멤버만.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GymScopedContentTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired WorkoutCrewRepository gyms;
    @Autowired WorkoutCrewMemberRepository members;
    @Autowired CmsEventRepository news;
    @Autowired EventRepository events;
    @Autowired EventService eventService;

    private User member;
    private User outsider;
    private WorkoutCrew openGym;
    private WorkoutCrew privateGym;

    @BeforeEach
    void setUp() {
        member = save("sc-member@test.local");
        outsider = save("sc-outsider@test.local");
        openGym = gym("sc-open-gym", GymVisibility.PUBLIC, "SCOPEN01");
        privateGym = gym("sc-private-gym", GymVisibility.PRIVATE, "SCPRIV01");
    }

    private User save(String email) {
        return users.save(User.builder().name(email).email(email).password("x").role("ROLE_USER")
                .nickname(email.substring(0, 10)).createdAt(LocalDateTime.now()).build());
    }

    private WorkoutCrew gym(String slug, GymVisibility visibility, String code) {
        WorkoutCrew g = gyms.save(WorkoutCrew.builder().name(slug).owner(member).inviteCode(code).type(GymType.CREW)
                .slug(slug).visibility(visibility).status(GymStatus.ACTIVE).features(EnumSet.allOf(GymFeature.class)).build());
        members.save(WorkoutCrewMember.builder().crew(g).user(member).role(WorkoutCrewMemberRole.OWNER).build());
        return g;
    }

    private long newsIn(WorkoutCrew gym, String title) {
        return news.save(CmsEvent.builder().title(title).summary("요약").content("내용").thumbnailUrl("/t.png")
                .startAt(LocalDateTime.now().minusDays(1)).endAt(LocalDateTime.now().plusDays(1))
                .status(CmsEventStatus.ACTIVE).ctaText("보기").ctaLink("/").gym(gym).build()).getId();
    }

    private static RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(u.getEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    private static String has(long id) {
        return "$.content[?(@.id == " + id + ")]";
    }

    @Test
    void newsIsSplitByGym() throws Exception {
        long global = newsIn(null, "전체 공지");
        long open = newsIn(openGym, "공개 모임 소식");
        long closed = newsIn(privateGym, "비공개 모임 소식");

        // 광장(로그인 없이): 전체 공지 + 공개 모임 소식, 비공개 모임 소식은 없음
        mvc.perform(get("/api/events?size=50")).andExpect(status().isOk())
                .andExpect(jsonPath(has(global)).isNotEmpty())
                .andExpect(jsonPath(has(open)).isNotEmpty())
                .andExpect(jsonPath(has(closed)).isEmpty());
        // 공개 모임을 고르면: 그 모임 소식 + 전체 공지
        mvc.perform(get("/api/events?size=50&gym=sc-open-gym")).andExpect(status().isOk())
                .andExpect(jsonPath(has(open)).isNotEmpty())
                .andExpect(jsonPath(has(global)).isNotEmpty())
                .andExpect(jsonPath(has(closed)).isEmpty());
        // 비공개 모임: 바깥 사람은 없는 모임처럼 404, 멤버는 보임
        mvc.perform(get("/api/events?gym=sc-private-gym")).andExpect(status().isNotFound());
        mvc.perform(get("/api/events?gym=sc-private-gym").with(as(outsider))).andExpect(status().isNotFound());
        mvc.perform(get("/api/events?size=50&gym=sc-private-gym").with(as(member))).andExpect(status().isOk())
                .andExpect(jsonPath(has(closed)).isNotEmpty())
                .andExpect(jsonPath(has(open)).isEmpty());
        // 상세도 같은 규칙
        mvc.perform(get("/api/events/" + closed)).andExpect(status().isNotFound());
        mvc.perform(get("/api/events/" + closed).with(as(member))).andExpect(status().isOk())
                .andExpect(jsonPath("$.gymSlug").value("sc-private-gym"));
        mvc.perform(get("/api/events/" + open)).andExpect(status().isOk())
                .andExpect(jsonPath("$.gymName").value("sc-open-gym"));
    }

    @Test
    void attendanceEventsCountOnlyForMembers() {
        LocalDate today = LocalDate.now();
        Event global = events.save(Event.builder().title("전체 이벤트").description("d").startDate(today.minusDays(1))
                .endDate(today.plusDays(1)).requiredAttendanceCount(3).status(EventStatus.ONGOING).build());
        Event gymOnly = events.save(Event.builder().title("모임 이벤트").description("d").startDate(today.minusDays(1))
                .endDate(today.plusDays(1)).requiredAttendanceCount(3).status(EventStatus.ONGOING).gym(openGym).build());

        List<Long> outsiderEvents = eventService.updateAttendanceProgress(outsider, today, false, true)
                .stream().map(EventProgressResponse::getEventId).toList();
        assertThat(outsiderEvents).contains(global.getId()).doesNotContain(gymOnly.getId());

        List<Long> memberEvents = eventService.updateAttendanceProgress(member, today, false, true)
                .stream().map(EventProgressResponse::getEventId).toList();
        assertThat(memberEvents).contains(global.getId(), gymOnly.getId());
    }

    @Test
    void gymOnlyBragStaysInsideTheGym() throws Exception {
        String res = mvc.perform(post("/api/brags").with(as(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"모임 자랑\",\"content\":\"100kg\",\"visibility\":\"GYM\",\"gymSlug\":\"sc-open-gym\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gymSlug").value("sc-open-gym"))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(res, "$.id")).longValue();

        // 멤버: 모임 피드에 있음
        mvc.perform(get("/api/brags?size=30&gym=sc-open-gym").with(as(member)))
                .andExpect(jsonPath(has(id)).isNotEmpty());
        // 바깥 사람: 광장 · 모임 피드 어디에도 없고, 상세 · 댓글은 403
        mvc.perform(get("/api/brags?size=30").with(as(outsider))).andExpect(jsonPath(has(id)).isEmpty());
        mvc.perform(get("/api/brags?size=30&gym=sc-open-gym").with(as(outsider))).andExpect(status().isOk())
                .andExpect(jsonPath(has(id)).isEmpty());
        mvc.perform(get("/api/brags/" + id).with(as(outsider))).andExpect(status().isForbidden());
        mvc.perform(get("/api/brags/" + id + "/comments").with(as(outsider))).andExpect(status().isForbidden());

        // 멤버가 아닌 모임에 올리기 → 403, 비공개 모임이면 404, 모임 없이 "우리 모임만" → 400
        mvc.perform(post("/api/brags").with(as(outsider)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"content\":\"x\",\"visibility\":\"GYM\",\"gymSlug\":\"sc-open-gym\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/brags").with(as(outsider)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"content\":\"x\",\"gymSlug\":\"sc-private-gym\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/brags").with(as(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"content\":\"x\",\"visibility\":\"GYM\"}"))
                .andExpect(status().isBadRequest());
        // 비공개 모임 피드는 바깥 사람에게 404
        mvc.perform(get("/api/brags?gym=sc-private-gym").with(as(outsider))).andExpect(status().isNotFound());
        // 고칠 때 공개 범위 · 모임을 안 보내면 그대로 남는다(광장으로 새지 않음)
        mvc.perform(put("/api/brags/" + id).with(as(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"모임 자랑(수정)\",\"content\":\"105kg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("GYM"))
                .andExpect(jsonPath("$.gymSlug").value("sc-open-gym"));
        mvc.perform(get("/api/brags?size=30").with(as(outsider))).andExpect(jsonPath(has(id)).isEmpty());
    }

    @Test
    void publicBragInGymShowsInSquareToo() throws Exception {
        String res = mvc.perform(post("/api/brags").with(as(member)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"공개 자랑\",\"content\":\"80kg\",\"visibility\":\"PUBLIC\",\"gymSlug\":\"sc-open-gym\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(res, "$.id")).longValue();
        mvc.perform(get("/api/brags?size=30").with(as(outsider))).andExpect(jsonPath(has(id)).isNotEmpty());
        mvc.perform(get("/api/brags?size=30&gym=sc-open-gym").with(as(outsider))).andExpect(jsonPath(has(id)).isNotEmpty());
    }
}
