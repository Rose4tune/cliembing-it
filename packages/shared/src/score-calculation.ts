/**
 * 점수 계산 유틸리티
 * 새로운 점수 산정 규칙 적용
 */

import type { ClimbingLevel } from "./level";
import { getLevelGroup, getLevelAbove } from "./level";

/**
 * party_ruleset.level_points JSONB 구조 타입
 */
export interface LevelPointsConfig {
  Grip?: {
    self: number;
    above: number;
  };
  Crux?: {
    White?: {
      self: number;
      above: number;
    };
    Hite?: {
      Purple: number;
      White: number;
    };
  };
}

/**
 * 기본 점수 설정 (party_ruleset이 없을 때 사용)
 */
const DEFAULT_LEVEL_POINTS: LevelPointsConfig = {
  Grip: {
    self: 5,
    above: 10,
  },
  Crux: {
    White: {
      self: 4,
      above: 10,
    },
    Hite: {
      Purple: 3,
      White: 7,
    },
  },
};

/**
 * 레벨별 문제당 점수 계산
 * @param solvedLevel 풀이한 레벨
 * @param userBaseLevel 사용자의 기준 레벨
 * @param levelPointsConfig party_ruleset.level_points 설정
 */
export function calculatePointsPerProblem(
  solvedLevel: ClimbingLevel,
  userBaseLevel: ClimbingLevel,
  levelPointsConfig?: LevelPointsConfig | null,
): number {
  const config = levelPointsConfig || DEFAULT_LEVEL_POINTS;

  // Hite 레벨 사용자 특수 처리
  if (userBaseLevel === "Hite") {
    if (!config.Crux?.Hite) {
      return 0;
    }
    if (solvedLevel === "Purple") {
      return config.Crux.Hite.Purple;
    }
    if (solvedLevel === "White") {
      return config.Crux.Hite.White;
    }
    return 0;
  }

  // 본인 레벨인 경우
  if (solvedLevel === userBaseLevel) {
    const group = getLevelGroup(userBaseLevel);
    if (group === "Grip" && config.Grip) {
      return config.Grip.self;
    }
    if (group === "Crux" && config.Crux?.White && userBaseLevel === "White") {
      return config.Crux.White.self;
    }
    return 0;
  }

  // 한 단계 위 레벨인 경우
  const levelAbove = getLevelAbove(userBaseLevel);
  if (levelAbove && solvedLevel === levelAbove) {
    const group = getLevelGroup(userBaseLevel);
    if (group === "Grip" && config.Grip) {
      return config.Grip.above;
    }
    if (group === "Crux" && config.Crux?.White && userBaseLevel === "White") {
      return config.Crux.White.above;
    }
    return 0;
  }

  // 인정되지 않는 레벨
  return 0;
}

/**
 * 레벨별 문제 개수와 점수 계산
 * @param solvedLevel 풀이한 레벨
 * @param problemCount 문제 개수
 * @param userBaseLevel 사용자의 기준 레벨
 * @param levelPointsConfig party_ruleset.level_points 설정
 */
export function calculateScoreForLevel(
  solvedLevel: ClimbingLevel,
  problemCount: number,
  userBaseLevel: ClimbingLevel,
  levelPointsConfig?: LevelPointsConfig | null,
): number {
  if (problemCount <= 0) return 0;

  const pointsPerProblem = calculatePointsPerProblem(
    solvedLevel,
    userBaseLevel,
    levelPointsConfig,
  );

  return pointsPerProblem * problemCount;
}

/**
 * calculateLevelScore는 calculateScoreForLevel의 별칭
 * 외부에서 사용하기 위한 간단한 이름
 */
export const calculateLevelScore = calculateScoreForLevel;

/**
 * 여러 레벨의 점수를 합산
 * @param levelCounts 레벨별 문제 개수 { "Navy": 1, "Purple": 3, "White": 1 }
 * @param userBaseLevel 사용자의 기준 레벨
 * @param levelPointsConfig party_ruleset.level_points 설정
 */
export function calculateTotalScore(
  levelCounts: Record<string, number>,
  userBaseLevel: ClimbingLevel,
  levelPointsConfig?: LevelPointsConfig | null,
): number {
  let totalScore = 0;

  for (const [level, count] of Object.entries(levelCounts)) {
    const score = calculateScoreForLevel(
      level as ClimbingLevel,
      count,
      userBaseLevel,
      levelPointsConfig,
    );
    totalScore += score;
  }

  return totalScore;
}
