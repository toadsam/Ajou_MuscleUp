package com.ajou.muscleup.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** 명단 정리 규칙: 공백 · 빈 줄 · 중복 제거, 순서 유지, 너무 긴 이름 거절. */
class ClubRosterServiceTest {

    @Test
    void normalizeTrimsDropsBlanksAndDuplicatesKeepingOrder() {
        List<String> out = ClubRosterService.normalize(Arrays.asList("  홍길동 ", "", null, "김철수", "홍길동", "   "));
        assertEquals(List.of("홍길동", "김철수"), out);
    }

    @Test
    void normalizeRejectsTooLongName() {
        String longName = "가".repeat(ClubRosterService.MAX_NAME_LENGTH + 1);
        assertThrows(ResponseStatusException.class, () -> ClubRosterService.normalize(List.of(longName)));
    }
}
