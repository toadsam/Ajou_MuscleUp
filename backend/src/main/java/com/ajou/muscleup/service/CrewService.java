package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.crew.CrewCreateRequest;
import com.ajou.muscleup.dto.crew.CrewDetailResponse;
import com.ajou.muscleup.dto.crew.CrewListItemResponse;
import com.ajou.muscleup.dto.crew.CrewUpdateRequest;
import com.ajou.muscleup.dto.crew.CrewChallengeCreateRequest;
import com.ajou.muscleup.dto.crew.CrewChallengeResponse;
import java.time.YearMonth;
import java.util.List;

public interface CrewService {
    CrewDetailResponse create(String email, CrewCreateRequest request);

    List<CrewListItemResponse> list(String email);

    CrewDetailResponse getDetail(String email, Long crewId, YearMonth month);

    void join(String email, Long crewId);

    void joinByInviteCode(String email, String inviteCode);

    void leave(String email, Long crewId);

    CrewDetailResponse update(String email, Long crewId, CrewUpdateRequest request);

    void delete(String email, Long crewId);

    void kickMember(String email, Long crewId, Long memberUserId);

    CrewChallengeResponse createChallenge(String email, Long crewId, CrewChallengeCreateRequest request);

    CrewChallengeResponse updateChallenge(String email, Long crewId, Long challengeId, CrewChallengeCreateRequest request);

    void deleteChallenge(String email, Long crewId, Long challengeId);
}
