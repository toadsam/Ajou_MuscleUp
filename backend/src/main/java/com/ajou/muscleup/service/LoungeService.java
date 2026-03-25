package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.lounge.LoungeProfileResponse;

public interface LoungeService {
    LoungeProfileResponse getProfile(String email);
}
