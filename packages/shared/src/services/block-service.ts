/**
 * 블럭 관련 서비스 함수
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClimbingLevel } from "../level";
import { getLevelAbove } from "../level";

/**
 * 블럭 획득 조건 확인 및 블럭 추가
 * @param supabase Supabase 클라이언트
 * @param partyId 파티 ID
 * @param userId 사용자 ID
 * @param solvedLevel 풀이한 레벨
 * @param submissionId 점수 제출 ID (team_block_events.submission_id)
 */
/**
 * 블럭 획득 조건 확인 및 블럭 추가
 * @param supabase Supabase 클라이언트
 * @param partyId 파티 ID
 * @param userId 사용자 ID
 * @param solvedLevel 풀이한 레벨
 * @param submissionId 점수 제출 ID (level_scores.id)
 * @param problemCount 문제 개수 (블럭 개수 결정)
 */
export async function addBlockForScoreApproval(
  supabase: SupabaseClient,
  partyId: string,
  userId: string,
  solvedLevel: ClimbingLevel,
  submissionId?: string | null,
  problemCount: number = 1,
): Promise<{
  success: boolean;
  blockAdded?: boolean;
  error?: string;
}> {
  try {
    // 1. 사용자의 기준 레벨 가져오기
    const { data: member, error: memberError } = await supabase
      .from("party_members")
      .select("level, team_id")
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
        blockAdded: false,
        error: "사용자의 기준 레벨이 설정되지 않았습니다",
      };
    }

    const teamId = member.team_id;
    if (!teamId) {
      return {
        success: false,
        blockAdded: false,
        error: "사용자가 팀에 속해있지 않습니다",
      };
    }

    // 2. 블럭 획득 조건 확인
    let isLeftBlock = false; // 본인 레벨 = 왼쪽, 한 단계 위 = 오른쪽
    let shouldGetBlock = false;

    if (solvedLevel === userBaseLevel) {
      // 본인 레벨
      isLeftBlock = true;
      shouldGetBlock = true;
    } else {
      // 한 단계 위 레벨 확인
      const levelAbove = getLevelAbove(userBaseLevel);
      if (levelAbove && solvedLevel === levelAbove) {
        isLeftBlock = false;
        shouldGetBlock = true;
      }
    }

    // Hite 레벨 사용자 특수 처리
    if (userBaseLevel === "Hite") {
      if (solvedLevel === "Purple") {
        isLeftBlock = true;
        shouldGetBlock = true;
      } else if (solvedLevel === "White") {
        isLeftBlock = false;
        shouldGetBlock = true;
      }
    }

    if (!shouldGetBlock) {
      return {
        success: true,
        blockAdded: false, // 블럭 획득 조건 미충족
      };
    }

    // 3. 사용자의 블럭 Set 조회
    const { data: blockSet, error: blockSetError } = await supabase
      .from("party_member_block_sets")
      .select("set_number")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .single();

    if (blockSetError || !blockSet) {
      return {
        success: false,
        blockAdded: false,
        error: "블럭 Set이 설정되지 않았습니다",
      };
    }

    // 4. Set의 왼쪽/오른쪽 블럭 타입 조회
    const { data: setData, error: setError } = await supabase
      .from("block_sets")
      .select(
        `
        left_block_type_id,
        right_block_type_id,
        left_block_type:left_block_type_id(name),
        right_block_type:right_block_type_id(name)
      `,
      )
      .eq("set_number", blockSet.set_number)
      .single();

    if (setError || !setData) {
      return {
        success: false,
        blockAdded: false,
        error: "블럭 Set 정보를 찾을 수 없습니다",
      };
    }

    // 5. 획득할 블럭 타입 결정
    const blockTypeId = isLeftBlock
      ? setData.left_block_type_id
      : setData.right_block_type_id;

    const leftBlockType = Array.isArray(setData.left_block_type)
      ? setData.left_block_type[0]
      : setData.left_block_type;
    const rightBlockType = Array.isArray(setData.right_block_type)
      ? setData.right_block_type[0]
      : setData.right_block_type;
    const blockTypeName = isLeftBlock
      ? (leftBlockType as { name: string } | null)?.name
      : (rightBlockType as { name: string } | null)?.name;

    if (!blockTypeId || !blockTypeName) {
      return {
        success: false,
        blockAdded: false,
        error: "블럭 타입 정보를 찾을 수 없습니다",
      };
    }

    // 6. team_block_events에 블럭 추가 (problem_count만큼 개별 레코드로 추가)
    // value > 1인 블럭을 분리하여 각각 개별 레코드로 저장
    const blocksToInsert = Array.from({ length: problemCount }, () => ({
      party_id: partyId,
      team_id: teamId,
      submission_id: submissionId || null,
      source: "solve" as const, // enum 값: solve, height_threshold, line_clear
      block_type: blockTypeName,
      value: 1, // 항상 1 (개별 레코드)
      game_session_id: null, // 게임 시작 전이므로 null
    }));

    console.log("🔍 블럭 추가 시도:", {
      partyId,
      teamId,
      userId,
      solvedLevel,
      submissionId,
      problemCount,
      blockTypeName,
      isLeftBlock,
      blocksToInsert: blocksToInsert.length,
    });

    const { data: insertedData, error: insertError } = await supabase
      .from("team_block_events")
      .insert(blocksToInsert)
      .select();

    if (insertError) {
      console.error("❌ 블럭 추가 실패:", {
        error: insertError,
        blocksToInsert,
      });
      return {
        success: false,
        blockAdded: false,
        error: `블럭 추가 실패: ${insertError.message}`,
      };
    }

    console.log("✅ 블럭 추가 성공:", {
      insertedCount: insertedData?.length || 0,
      insertedData,
    });

    return {
      success: true,
      blockAdded: true,
    };
  } catch (error) {
    return {
      success: false,
      blockAdded: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
