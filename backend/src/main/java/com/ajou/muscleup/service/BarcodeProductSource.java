package com.ajou.muscleup.service;

import java.util.List;

/**
 * 바코드 → 제품 신고 정보(이름 · 회사). 실제 구현은 식약처 식품안전나라 "바코드연계제품정보"(FoodSafetyBarcodeSource),
 * 테스트는 가짜로 바꿔 끼운다(외부 호출 없이 BarcodeService 를 확인하려고).
 */
public interface BarcodeProductSource {

    /**
     * @param category 식품 유형(예: 유탕면, 탄산음료)
     * @param active   생산 종료 · 폐업이 아닌 줄(같은 바코드가 여러 줄 — 공장 · 회사가 바뀐 기록)
     */
    record Product(String name, String maker, String category, boolean active) {}

    /** 키가 있어 조회할 수 있는가 */
    boolean enabled();

    /** 못 찾으면 빈 목록. 조회 자체가 실패하면 ResponseStatusException */
    List<Product> lookup(String barcode);
}
