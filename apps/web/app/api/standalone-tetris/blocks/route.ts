import { NextResponse } from "next/server";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 독립 테트리스 게임 블럭 관리 API
 * GET: 팀별 블럭 조회
 * POST: 팀에 블럭 추가 (게임 진행 중이면 에러)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return errorResponse("teamId 파라미터가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    const blocksResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("standalone_tetris_blocks")
        .select("*")
        .eq("team_id", teamId)
        // 정렬을 강제로 하지 않아서, 생성/업데이트된 순서(id) 기준으로 반환되도록 둔다
        .order("created_at", { ascending: true });
    });

    if (!blocksResult.success) {
      return errorResponse(blocksResult.error?.message || "블럭 조회 실패", 500);
    }

    return successResponse({ blocks: blocksResult.data || [] });
  } catch (error) {
    console.error("블럭 조회 에러:", error);
    return errorResponse("서버 오류가 발생했습니다", 500);
  }
}

/**
 * 팀에 블럭 추가
 * 게임 진행 중이면 에러 반환
 */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { teamId, blockType, quantity } = body;

    if (!teamId || !blockType || !quantity || quantity <= 0) {
      return errorResponse("teamId, blockType, quantity가 필요합니다", 400);
    }

    // 게임 진행 중인지 확인
    const gameResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("standalone_tetris_games")
        .select("status")
        .eq("team_id", teamId)
        .maybeSingle();
    });

    if (gameResult.success && gameResult.data) {
      const status = (gameResult.data as any).status;
      if (status === "running" || status === "paused") {
        return errorResponse("게임 진행 중에는 블럭을 추가할 수 없습니다", 400);
      }
    }

    // 다른 팀이 게임 진행 중인지 확인
    const runningGameResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("standalone_tetris_games")
        .select("team_id")
        .eq("status", "running")
        .limit(1)
        .maybeSingle();
    });

    if (runningGameResult.success && runningGameResult.data) {
      return errorResponse("다른 팀이 게임을 진행 중입니다", 400);
    }

    // 기존 블럭이 있으면 수량 추가, 없으면 생성
    const existingResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("standalone_tetris_blocks")
        .select("*")
        .eq("team_id", teamId)
        .eq("block_type", blockType)
        .maybeSingle();
    });

    if (existingResult.success && existingResult.data) {
      // 기존 블럭 수량 증가
      const updateResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_blocks")
          .update({
            quantity: (existingResult.data as any).quantity + quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (existingResult.data as any).id)
          .select()
          .single();
      });

      if (!updateResult.success) {
        return errorResponse(updateResult.error?.message || "블럭 추가 실패", 500);
      }

      return successResponse({ block: updateResult.data });
    } else {
      // 새 블럭 생성
      const createResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_blocks")
          .insert({
            team_id: teamId,
            block_type: blockType,
            quantity: quantity,
          })
          .select()
          .single();
      });

      if (!createResult.success) {
        return errorResponse(createResult.error?.message || "블럭 추가 실패", 500);
      }

      return successResponse({ block: createResult.data });
    }
  } catch (error) {
    console.error("블럭 추가 에러:", error);
    return errorResponse("서버 오류가 발생했습니다", 500);
  }
}
