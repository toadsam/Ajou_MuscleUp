package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.ajou.muscleup.service.GymPermissionService.GymAction;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 역할 표(docs/design/stage0-gyms.md §1)를 그대로 확인한다. */
class GymPermissionServiceTest {

    @Test
    void ownerCanDoEverything() {
        for (GymAction a : GymAction.values()) {
            assertTrue(GymPermissionService.allows(WorkoutCrewMemberRole.OWNER, a), a.name());
        }
    }

    @Test
    void staffManagesMembersAndContentButNotSettingsOrStaff() {
        assertTrue(GymPermissionService.allows(WorkoutCrewMemberRole.STAFF, GymAction.MANAGE_MEMBERS));
        assertTrue(GymPermissionService.allows(WorkoutCrewMemberRole.STAFF, GymAction.MANAGE_CONTENT));
        assertTrue(GymPermissionService.allows(WorkoutCrewMemberRole.STAFF, GymAction.VIEW_MEMBERS));
        assertFalse(GymPermissionService.allows(WorkoutCrewMemberRole.STAFF, GymAction.MANAGE_SETTINGS));
        assertFalse(GymPermissionService.allows(WorkoutCrewMemberRole.STAFF, GymAction.MANAGE_STAFF));
    }

    @Test
    void memberOnlyViews() {
        for (GymAction a : GymAction.values()) {
            assertEquals(a == GymAction.VIEW_MEMBERS, GymPermissionService.allows(WorkoutCrewMemberRole.MEMBER, a), a.name());
        }
    }
}
