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
export async function addBlockForScoreApproval(
  supabase: SupabaseClient,
  partyId: string,
  userId: string,
  solvedLevel: ClimbingLevel,
  submissionId?: string | null,
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

    const blockTypeName = isLeftBlock
      ? (setData.left_block_type as { name: string })?.name
      : (setData.right_block_type as { name: string })?.name;

    if (!blockTypeId || !blockTypeName) {
      return {
        success: false,
        blockAdded: false,
        error: "블럭 타입 정보를 찾을 수 없습니다",
      };
    }

    // 6. team_block_events에 블럭 추가
    const { error: insertError } = await supabase
      .from("team_block_events")
      .insert({
        party_id: partyId,
        team_id: teamId,
        submission_id: submissionId || null,
        source: "score_approval",
        block_type: blockTypeName,
        value: 1, // 블럭 1개 추가
      });

    if (insertError) {
      return {
        success: false,
        blockAdded: false,
        error: `블럭 추가 실패: ${insertError.message}`,
      };
    }

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
