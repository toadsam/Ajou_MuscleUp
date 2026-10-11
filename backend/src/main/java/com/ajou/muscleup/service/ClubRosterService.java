package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.club.ClubRosterResponse;
import com.ajou.muscleup.entity.ClubRosterMember;
import com.ajou.muscleup.repository.ClubRosterMemberRepository;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class ClubRosterService {
    static final int MAX_NAME_LENGTH = 30;

    private final ClubRosterMemberRepository repository;

    @Transactional(readOnly = true)
    public ClubRosterResponse get() {
        return new ClubRosterResponse(repository.findAllByOrderBySortOrderAsc().stream()
                .map(ClubRosterMember::getName)
                .toList());
    }

    /** 명단을 통째로 바꾼다. 앞뒤 공백 · 빈 줄 · 중복은 정리하고, 입력한 순서를 유지한다. */
    @Transactional
    public ClubRosterResponse replace(List<String> rawNames) {
        List<String> names = normalize(rawNames);
        repository.deleteAllInBatch();
        List<ClubRosterMember> rows = new ArrayList<>(names.size());
        for (int i = 0; i < names.size(); i++) {
            rows.add(ClubRosterMember.builder().name(names.get(i)).sortOrder(i).build());
        }
        repository.saveAll(rows);
        return new ClubRosterResponse(names);
    }

    static List<String> normalize(List<String> rawNames) {
        Set<String> seen = new LinkedHashSet<>();
        for (String raw : rawNames) {
            if (raw == null) continue;
            String name = raw.strip();
            if (name.isEmpty()) continue;
            if (name.length() > MAX_NAME_LENGTH) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "이름은 " + MAX_NAME_LENGTH + "자까지 넣을 수 있어요: " + name.substring(0, 10) + "…");
            }
            seen.add(name);
        }
        return List.copyOf(seen);
    }
}
