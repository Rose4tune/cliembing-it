/**
 * 점수 관련 서비스 함수
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClimbingLevel } from "../level";
import type { LevelPointsConfig } from "../score-calculation";
import {
  calculateScoreForLevel,
  calculateTotalScore,
} from "../score-calculation";
import { isScoreEligible } from "../level";

/**
 * 사용자의 총 점수 재계산 및 집계 테이블 업데이트
 * @param recentlyApprovedScoreId 방금 승인한 레코드의 ID (선택사항, 트랜잭션 타이밍 문제 해결용)
 */
export async function recalculateUserTotalScore(
  supabase: SupabaseClient,
  partyId: string,
  userId: string,
  recentlyApprovedScoreId?: string,
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
    // 트랜잭션 타이밍 문제를 해결하기 위해 두 가지 방법으로 조회:
    // 1) approved = true인 모든 레코드
    // 2) 방금 승인한 레코드 (명시적으로 포함)
    const { data: approvedScores, error: scoresError } = await supabase
      .from("level_scores")
      .select("level, problem_count")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .eq("approved", true);

    // 방금 승인한 레코드가 있으면 별도로 조회하여 포함 (트랜잭션 타이밍 문제 해결)
    let recentlyApprovedScore: { level: string; problem_count: number } | null =
      null;
    if (recentlyApprovedScoreId) {
      const { data: recentScore } = await supabase
        .from("level_scores")
        .select("level, problem_count, approved")
        .eq("id", recentlyApprovedScoreId)
        .eq("party_id", partyId)
        .eq("user_id", userId)
        .single();

      // approved = true인 경우에만 포함
      if (recentScore && recentScore.approved === true) {
        recentlyApprovedScore = {
          level: recentScore.level,
          problem_count: recentScore.problem_count,
        };
      }
    }

    // 두 결과를 합치기 (중복 제거)
    const allApprovedScores = [...(approvedScores || [])];
    if (recentlyApprovedScore) {
      // 방금 승인한 레코드가 이미 approvedScores에 포함되어 있는지 확인
      // 같은 레벨의 레코드가 여러 개일 수 있으므로, ID 기반으로 확인하는 것이 더 정확하지만
      // 여기서는 레벨과 개수가 같으면 중복으로 간주
      const alreadyIncluded = allApprovedScores.some(
        (score) =>
          score.level === recentlyApprovedScore!.level &&
          score.problem_count === recentlyApprovedScore!.problem_count,
      );
      if (!alreadyIncluded) {
        allApprovedScores.push(recentlyApprovedScore);
      }
    }

    if (scoresError) {
      return {
        success: false,
        error: "승인된 점수 조회에 실패했습니다",
      };
    }

    // 레벨별 문제 개수 집계 (점수 인정 범위 내만)
    const approvedProblemCounts: Record<string, number> = {};
    let totalScore = 0;

    if (allApprovedScores && allApprovedScores.length > 0) {
      for (const score of allApprovedScores) {
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

// calculateLevelScore는 score-calculation.ts에서 이미 export되므로
// 여기서는 제거 (중복 export 방지)
