import { NextResponse } from "next/server";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import { calculateScore } from "@pkg/shared/services/tetris-game-service";

/**
 * 독립 테트리스 게임 세션 관리 API
 * GET: 게임 세션 목록 조회
 * POST: 게임 제어 (reset, resume, start, pause, finish, update)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    const supabase = createAdminClient();

    let query = supabase
      .from("standalone_tetris_games")
      .select("*")
      .order("total_score", { ascending: false }); // 총점 기준 정렬

    if (teamId) {
      query = query.eq("team_id", teamId);
    }

    const gamesResult = await executeSupabaseQuery(async () => {
      return await query;
    });

    if (!gamesResult.success) {
      return errorResponse(gamesResult.error?.message || "게임 세션 조회 실패", 500);
    }

    return successResponse({ games: gamesResult.data || [] });
  } catch (error) {
    console.error("게임 세션 조회 에러:", error);
    return errorResponse("서버 오류가 발생했습니다", 500);
  }
}

/**
 * 게임 세션 생성/업데이트
 */
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { action, teamId, boardSnapshot, completedLines, totalScore, blocksUsed } = body;

    if (!action) {
      return errorResponse("action이 필요합니다", 400);
    }

    if (action === "reset") {
      // 새 게임 시작하기: 모든 팀 초기화
      const deleteGamesResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      });

      const deleteBlocksResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_blocks")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      });

      if (!deleteGamesResult.success || !deleteBlocksResult.success) {
        return errorResponse("게임 초기화 실패", 500);
      }

      return successResponse({ message: "모든 게임이 초기화되었습니다" });
    }

    if (action === "resume") {
      // 기존 게임 이어하기: 가장 최근 게임 복원
      const latestGameResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      });

      if (!latestGameResult.success) {
        return errorResponse("게임 조회 실패", 500);
      }

      if (!latestGameResult.data) {
        return successResponse({ game: null, message: "이어할 게임이 없습니다" });
      }

      return successResponse({ game: latestGameResult.data });
    }

    if (action === "start") {
      // 게임 시작
      if (!teamId) {
        return errorResponse("teamId가 필요합니다", 400);
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
        const runningTeamId = (runningGameResult.data as any).team_id;
        if (runningTeamId !== teamId) {
          return errorResponse("다른 팀이 게임을 진행 중입니다", 400);
        }
      }

      // 기존 게임 레코드 조회 또는 생성
      const existingResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .select("*")
          .eq("team_id", teamId)
          .maybeSingle();
      });

      // 대기열의 블럭 조회
      const blocksResult = await executeSupabaseQuery(async () => {
        return await supabase.from("standalone_tetris_blocks").select("*").eq("team_id", teamId);
      });

      const availableBlocks: any[] = [];
      if (blocksResult.success && blocksResult.data) {
        blocksResult.data.forEach((block: any) => {
          for (let i = 0; i < block.quantity; i++) {
            availableBlocks.push({
              id: `${Date.now()}-${Math.random()}-${i}`,
              block_type: block.block_type,
            });
          }
        });
      }

      if (existingResult.success && existingResult.data) {
        // 기존 레코드 업데이트
        const updateResult = await executeSupabaseQuery(async () => {
          return await supabase
            .from("standalone_tetris_games")
            .update({
              status: "running",
              started_at: new Date().toISOString(),
              paused_at: null,
              board_snapshot: boardSnapshot || { board: null, availableBlocks: [] },
              available_blocks: availableBlocks,
              lines_cleared: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("team_id", teamId)
            .select()
            .single();
        });

        if (!updateResult.success) {
          return errorResponse(updateResult.error?.message || "게임 시작 실패", 500);
        }

        return successResponse({ game: updateResult.data });
      } else {
        // 새 레코드 생성
        const createResult = await executeSupabaseQuery(async () => {
          return await supabase
            .from("standalone_tetris_games")
            .insert({
              team_id: teamId,
              status: "running",
              started_at: new Date().toISOString(),
              board_snapshot: boardSnapshot || { board: null, availableBlocks: [] },
              available_blocks: availableBlocks,
              lines_cleared: 0,
              total_score: 0,
              game_count: 0,
              total_blocks_used: 0,
            })
            .select()
            .single();
        });

        if (!createResult.success) {
          return errorResponse(createResult.error?.message || "게임 시작 실패", 500);
        }

        return successResponse({ game: createResult.data });
      }
    }

    if (action === "pause") {
      // 게임 중지
      if (!teamId) {
        return errorResponse("teamId가 필요합니다", 400);
      }

      const existingResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .select("*")
          .eq("team_id", teamId)
          .maybeSingle();
      });

      if (!existingResult.success || !existingResult.data) {
        return errorResponse("진행 중인 게임이 없습니다", 404);
      }

      const existingGame = existingResult.data as any;
      const updateResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .update({
            status: "paused",
            paused_at: new Date().toISOString(),
            board_snapshot: boardSnapshot || existingGame.board_snapshot,
            available_blocks: boardSnapshot?.availableBlocks || existingGame.available_blocks,
            lines_cleared: completedLines ?? existingGame.lines_cleared,
            updated_at: new Date().toISOString(),
          })
          .eq("team_id", teamId)
          .select()
          .single();
      });

      if (!updateResult.success) {
        return errorResponse(updateResult.error?.message || "게임 중지 실패", 500);
      }

      return successResponse({ game: updateResult.data });
    }

    if (action === "finish") {
      // 게임 완료
      if (!teamId) {
        return errorResponse("teamId가 필요합니다", 400);
      }

      const existingResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .select("*")
          .eq("team_id", teamId)
          .maybeSingle();
      });

      if (!existingResult.success || !existingResult.data) {
        return errorResponse("진행 중인 게임이 없습니다", 404);
      }

      const existingGame = existingResult.data as any;
      // 서버에서 최종 점수 계산
      const finalBoard = boardSnapshot?.board;
      const currentGameScore = finalBoard ? calculateScore(finalBoard) : totalScore || 0;
      const newTotalScore = (Number(existingGame.total_score) || 0) + currentGameScore;
      const newGameCount = (existingGame.game_count || 0) + 1;
      const newTotalBlocksUsed = (existingGame.total_blocks_used || 0) + (blocksUsed || 0);

      // 게임 완료 시 사용한 블럭을 DB에서 제거
      // available_blocks에서 사용한 블럭 추적
      const usedBlocks = existingGame.available_blocks || [];
      const usedBlockTypes = new Map<string, number>();
      usedBlocks.forEach((block: any) => {
        const blockType = block.block_type || block.type;
        usedBlockTypes.set(blockType, (usedBlockTypes.get(blockType) || 0) + 1);
      });

      // 각 블럭 타입별로 quantity 감소
      for (const [blockType, count] of usedBlockTypes.entries()) {
        const blockResult = await executeSupabaseQuery(async () => {
          return await supabase
            .from("standalone_tetris_blocks")
            .select("id, quantity")
            .eq("team_id", teamId)
            .eq("block_type", blockType)
            .maybeSingle();
        });

        if (blockResult.success && blockResult.data) {
          const currentQuantity = (blockResult.data as any).quantity || 0;
          const newQuantity = Math.max(0, currentQuantity - count);
          if (newQuantity > 0) {
            await executeSupabaseQuery(async () => {
              return await supabase
                .from("standalone_tetris_blocks")
                .update({
                  quantity: newQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", (blockResult.data as any).id);
            });
          } else {
            // quantity가 0이면 레코드 삭제
            await executeSupabaseQuery(async () => {
              return await supabase
                .from("standalone_tetris_blocks")
                .delete()
                .eq("id", (blockResult.data as any).id);
            });
          }
        }
      }

      const updateResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .update({
            status: "finished",
            finished_at: new Date().toISOString(),
            board_snapshot: boardSnapshot || existingGame.board_snapshot,
            available_blocks: [],
            lines_cleared: completedLines ?? existingGame.lines_cleared,
            total_score: newTotalScore,
            game_count: newGameCount,
            total_blocks_used: newTotalBlocksUsed,
            updated_at: new Date().toISOString(),
          })
          .eq("team_id", teamId)
          .select()
          .single();
      });

      if (!updateResult.success) {
        return errorResponse(updateResult.error?.message || "게임 완료 실패", 500);
      }

      return successResponse({ game: updateResult.data });
    }

    if (action === "update") {
      // 게임 상태 업데이트 (주기적 저장)
      if (!teamId) {
        return errorResponse("teamId가 필요합니다", 400);
      }

      const existingResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .select("*")
          .eq("team_id", teamId)
          .maybeSingle();
      });

      if (!existingResult.success || !existingResult.data) {
        return errorResponse("진행 중인 게임이 없습니다", 404);
      }

      const existingGame = existingResult.data as any;
      const updateResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("standalone_tetris_games")
          .update({
            board_snapshot: boardSnapshot || existingGame.board_snapshot,
            available_blocks: boardSnapshot?.availableBlocks || existingGame.available_blocks,
            lines_cleared: completedLines ?? existingGame.lines_cleared,
            updated_at: new Date().toISOString(),
          })
          .eq("team_id", teamId)
          .select()
          .single();
      });

      if (!updateResult.success) {
        return errorResponse(updateResult.error?.message || "게임 상태 업데이트 실패", 500);
      }

      return successResponse({ game: updateResult.data });
    }

    return errorResponse("잘못된 action입니다", 400);
  } catch (error) {
    console.error("게임 세션 관리 에러:", error);
    return errorResponse("서버 오류가 발생했습니다", 500);
  }
}
