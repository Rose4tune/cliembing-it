import { NextResponse } from "next/server";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 독립 테트리스 게임 팀 관리 API
 * GET: 팀 목록 조회 (1~10 팀, 총점, 게임 횟수, 사용 블럭 개수 포함)
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    // 팀 목록 조회
    const teamsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("standalone_tetris_teams")
        .select("*")
        .order("team_number", { ascending: true });
    });

    if (!teamsResult.success) {
      return errorResponse(teamsResult.error?.message || "팀 목록 조회 실패", 500);
    }

    // 각 팀의 게임 정보 조회
    const gamesResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("standalone_tetris_games")
        .select("team_id, total_score, game_count, total_blocks_used, status");
    });

    const gamesMap = new Map();
    if (gamesResult.success && gamesResult.data) {
      gamesResult.data.forEach((game: any) => {
        gamesMap.set(game.team_id, {
          totalScore: Number(game.total_score) || 0,
          gameCount: game.game_count || 0,
          totalBlocksUsed: game.total_blocks_used || 0,
          status: game.status || "idle",
        });
      });
    }

    // 팀 정보와 게임 정보 결합
    const teamsWithStats = (teamsResult.data || []).map((team: any) => {
      const gameInfo = gamesMap.get(team.id) || {
        totalScore: 0,
        gameCount: 0,
        totalBlocksUsed: 0,
        status: "idle",
      };

      return {
        id: team.id,
        teamNumber: team.team_number,
        name: team.name,
        totalScore: gameInfo.totalScore,
        gameCount: gameInfo.gameCount,
        totalBlocksUsed: gameInfo.totalBlocksUsed,
        status: gameInfo.status,
      };
    });

    return successResponse({ teams: teamsWithStats });
  } catch (error) {
    console.error("팀 목록 조회 에러:", error);
    return errorResponse("서버 오류가 발생했습니다", 500);
  }
}
