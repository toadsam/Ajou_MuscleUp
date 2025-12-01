package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.MyPageResponse;

public interface MyPageService {
    MyPageResponse fetch(String userEmail);
}
