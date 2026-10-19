// 음식 검색(/api/diet/foods) 응답 타입과 화면 문구. 값은 100g 또는 100ml 기준.

export type FoodHit = {
  id: number;
  source: "PROCESSED" | "DISH" | "RAW";
  name: string;
  maker: string | null;
  basis: "100g" | "100ml";
  kcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
  /** 1회 섭취참고량(제품) · 1인분(음식) */
  servingG: number | null;
  /** 포장 전체(제품) */
  packageG: number | null;
};

export const FOOD_SOURCE_LABEL: Record<FoodHit["source"], string> = {
  PROCESSED: "제품",
  DISH: "음식",
  RAW: "식재료",
};

export const FOOD_DATA_CREDIT = "자료: 식품의약품안전처 식품영양성분 데이터베이스 · 농촌진흥청 국가표준식품성분 DB";

/** 사진 분석(/api/diet/photo) 후보 하나. matches 가 비면 AI 추정값(ai*)을 쓴다 */
export type PhotoCandidate = {
  name: string;
  searchName: string;
  grams: number;
  confidence: number;
  aiKcal: number | null;
  aiProteinG: number | null;
  aiCarbG: number | null;
  aiFatG: number | null;
  matches: FoodHit[];
};

export type PhotoResult = { food: boolean; items: PhotoCandidate[]; catalogReady: boolean; dailyLimit: number };

/** 바코드 조회(/api/diet/barcode/{code}). 제품 이름은 식약처 바코드 정보, matches 는 그 이름으로 찾은 음식 DB 후보 */
export type BarcodeResult = {
  barcode: string;
  found: boolean;
  name: string | null;
  maker: string | null;
  category: string | null;
  otherNames: string[];
  matches: FoodHit[];
  catalogReady: boolean;
};
