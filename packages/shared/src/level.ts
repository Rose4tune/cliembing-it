/**
 * 클라이밍 레벨 관련 타입 및 상수
 */

/**
 * 클라이밍 레벨
 */
export type ClimbingLevel =
  | "Red"
  | "Orange"
  | "Yellow"
  | "Green"
  | "Blue"
  | "Navy"
  | "Purple"
  | "Hite"
  | "White"
  | "Black";

/**
 * 레벨 그룹
 */
export type LevelGroup = "Crux" | "Grip";

/**
 * 레벨 그룹 매핑
 */
export const LEVEL_GROUPS: Record<LevelGroup, ClimbingLevel[]> = {
  Crux: ["Hite", "White"],
  Grip: ["Blue", "Navy", "Purple"],
};

/**
 * 레벨에서 그룹 찾기
 */
export function getLevelGroup(level: ClimbingLevel): LevelGroup | null {
  if (LEVEL_GROUPS.Crux.includes(level)) {
    return "Crux";
  }
  if (LEVEL_GROUPS.Grip.includes(level)) {
    return "Grip";
  }
  return null;
}

/**
 * 레벨 한글 표시
 */
export const LEVEL_LABELS: Record<ClimbingLevel, string> = {
  Red: "레드",
  Orange: "오렌지",
  Yellow: "옐로우",
  Green: "그린",
  Blue: "블루",
  Navy: "네이비",
  Purple: "퍼플",
  Hite: "하이트",
  White: "화이트",
  Black: "블랙",
};

/**
 * 현재 파티에서 비활성화된 레벨 (임시)
 */
export const DISABLED_LEVELS: ClimbingLevel[] = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
];

/**
 * 활성화된 레벨 목록 (파티 점수 입력용)
 */
export const ENABLED_LEVELS: ClimbingLevel[] = [
  "Blue",
  "Navy",
  "Purple",
  "Hite",
  "White",
  "Black",
];

/**
 * 모든 레벨 목록 (기본 레벨 설정용)
 */
export const ALL_LEVELS: ClimbingLevel[] = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Navy",
  "Purple",
  "Hite",
  "White",
  "Black",
];

/**
 * 레벨 순서 (점수 계산용)
 */
export const LEVEL_ORDER: Record<ClimbingLevel, number> = {
  Red: 1,
  Orange: 2,
  Yellow: 3,
  Green: 4,
  Blue: 5,
  Navy: 6,
  Purple: 7,
  Hite: 8,
  White: 9,
  Black: 10,
};

/**
 * 레벨별 기본 점수 가중치 (문제 수 * 가중치 = 점수)
 * 추후 파티별로 설정 가능하도록 확장 예정
 */
export const LEVEL_WEIGHTS: Record<ClimbingLevel, number> = {
  Red: 0, // disabled
  Orange: 0, // disabled
  Yellow: 0, // disabled
  Green: 0, // disabled
  Blue: 1,
  Navy: 2,
  Purple: 3,
  Hite: 2,
  White: 3,
  Black: 4, // Black 레벨 가중치 (추후 조정 가능)
};

/**
 * 문제 수로부터 점수 계산
 */
export function calculateScore(
  level: ClimbingLevel,
  problemCount: number,
): number {
  const weight = LEVEL_WEIGHTS[level];
  return problemCount * weight;
}

/**
 * 숫자 레벨을 ClimbingLevel로 변환
 * 1 = Red, 2 = Orange, ..., 10 = Black
 */
export function numberToLevel(
  levelNumber: number | null | undefined,
): ClimbingLevel | null {
  if (!levelNumber || levelNumber < 1 || levelNumber > 10) {
    return null;
  }
  const levelMap: Record<number, ClimbingLevel> = {
    1: "Red",
    2: "Orange",
    3: "Yellow",
    4: "Green",
    5: "Blue",
    6: "Navy",
    7: "Purple",
    8: "Hite",
    9: "White",
    10: "Black",
  };
  return levelMap[levelNumber] || null;
}

/**
 * ClimbingLevel을 숫자로 변환
 * Red = 1, Orange = 2, ..., Black = 10
 */
export function levelToNumber(level: ClimbingLevel): number {
  return LEVEL_ORDER[level];
}
