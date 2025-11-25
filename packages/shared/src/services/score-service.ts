/**
 * 점수 관련 서비스 함수
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClimbingLevel, LevelPointsConfig } from "../score-calculation";
import {
  calculateScoreForLevel,
  calculateTotalScore,
  isScoreEligible,
} from "../score-calculation";

/**
 * 사용자의 총 점수 재계산 및 집계 테이블 업데이트
 */
export async function recalculateUserTotalScore(
  supabase: SupabaseClient,
  partyId: string,
  userId: string,
): Promise<{
  success: boolean;
  totalScore?: number;
  approvedProblemCounts?: Record<string, number>;
  error?: string;
}> {
  try {
    // 1. 사용자의 기준 레벨 가져오기
    const { data: member, error: memberError } = await supabase
      .from("party_members")
      .select("level")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .single();

    if (memberError || !member) {
      return {
        success: false,
        error: "파티 멤버 정보를 찾을 수 없습니다",
      };
    }

    const userBaseLevel = member.level as ClimbingLevel | null;
    if (!userBaseLevel) {
      return {
        success: false,
        error: "사용자의 기준 레벨이 설정되지 않았습니다",
      };
    }

    // 2. party_ruleset에서 점수 설정 가져오기
    const { data: ruleset } = await supabase
      .from("party_ruleset")
      .select("level_points")
      .eq("party_id", partyId)
      .single();

    const levelPointsConfig: LevelPointsConfig | null =
      ruleset?.level_points || null;

    // 3. 승인된 레벨별 문제 개수 집계
    const { data: approvedScores, error: scoresError } = await supabase
      .from("level_scores")
      .select("level, problem_count")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .eq("approved", true);

    if (scoresError) {
      return {
        success: false,
        error: "승인된 점수 조회에 실패했습니다",
      };
    }

    // 레벨별 문제 개수 집계 (점수 인정 범위 내만)
    const approvedProblemCounts: Record<string, number> = {};
    let totalScore = 0;

    if (approvedScores) {
      for (const score of approvedScores) {
        const level = score.level as ClimbingLevel;

        // 점수 인정 범위 확인
        if (!isScoreEligible(level, userBaseLevel)) {
          continue; // 인정되지 않는 레벨은 무시
        }

        // 레벨별 개수 합산
        approvedProblemCounts[level] =
          (approvedProblemCounts[level] || 0) + score.problem_count;
      }

      // 총 점수 계산
      totalScore = calculateTotalScore(
        approvedProblemCounts,
        userBaseLevel,
        levelPointsConfig,
      );
    }

    // 4. user_total_scores 테이블 업데이트 (upsert)
    const { error: upsertError } = await supabase
      .from("user_total_scores")
      .upsert(
        {
          party_id: partyId,
          user_id: userId,
          total_score: totalScore,
          approved_problem_counts: approvedProblemCounts,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "party_id,user_id",
        },
      );

    if (upsertError) {
      return {
        success: false,
        error: `집계 테이블 업데이트 실패: ${upsertError.message}`,
      };
    }

    return {
      success: true,
      totalScore,
      approvedProblemCounts,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 단일 레벨 점수 계산 (점수 저장 시 사용)
 */
export function calculateLevelScore(
  level: ClimbingLevel,
  problemCount: number,
  userBaseLevel: ClimbingLevel,
  levelPointsConfig?: LevelPointsConfig | null,
): number {
  return calculateScoreForLevel(
    level,
    problemCount,
    userBaseLevel,
    levelPointsConfig,
  );
}
