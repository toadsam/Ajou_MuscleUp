package com.ajou.muscleup.service;

import java.util.List;

/**
 * 음식 사진 → 음식 후보(식단 기록 PR C). 실제 구현은 OpenAI 이미지 모델(OpenAiFoodPhotoRecognizer),
 * 테스트는 가짜로 바꿔 끼운다(외부 호출 없이 FoodPhotoService 를 확인하려고).
 */
public interface FoodPhotoRecognizer {

    /**
     * @param searchName 음식 검색(FoodCatalogService)에 넣을 일반적인 한국어 이름(예: 현미밥, 닭가슴살)
     * @param grams      보이는 양(g) 추정
     * @param kcal       그 양의 칼로리 추정 — 검색에서 못 찾을 때만 쓴다(protein · carb · fat 도 같음)
     */
    record Recognized(String name, String searchName, double grams, Double kcal, Double proteinG, Double carbG,
                      Double fatG, double confidence) {}

    record Result(boolean food, List<Recognized> items) {}

    /** image 는 jpeg · png · webp 바이트. 실패하면 ResponseStatusException */
    Result recognize(byte[] image, String contentType);
}
