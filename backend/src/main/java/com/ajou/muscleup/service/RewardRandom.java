package com.ajou.muscleup.service;

import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

/** 보상 상자 · 행운 상자 뽑기용 난수. 테스트는 정해진 값을 돌려주는 걸로 바꿔 끼운다. */
@Component
public class RewardRandom {
    /** 0 이상 bound 미만 */
    public int nextInt(int bound) {
        return ThreadLocalRandom.current().nextInt(bound);
    }
}
