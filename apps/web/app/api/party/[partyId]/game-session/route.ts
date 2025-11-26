import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

type GameStatus = "pending" | "running" | "finished" | "cancelled";

interface BoardSnapshot {
  board: Array<Array<string | null>>;
  availableBlocks: Array<{
    id: string;
    block_type: string;
  }>;
  currentPiece?: {
    x: number;
    y: number;
    shape: number[][];
    color: string;
  };
}

/**
 * 게임 세션 조회 API
 * GET /api/party/[partyId]/game-session?teamId=xxx
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const { partyId } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return errorResponse("teamId 파라미터가 필요합니다", 400);
    }

    const supabase = await createServerClient();

    // 최신 게임 세션 조회 (pending, running 상태만)
    const { data: gameSession, error } = await executeSupabaseQuery(async () => {
      return await supabase
        .from("game_sessions")
        .select("*")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    });

    if (error) {
      return errorResponse(error.message || "게임 세션 조회에 실패했습니다", 500);
    }

    if (!gameSession) {
      return successResponse({ data: null });
    }

    // board_snapshot 파싱
    let boardSnapshot: BoardSnapshot | null = null;
    if (gameSession.board_snapshot) {
      try {
        boardSnapshot = gameSession.board_snapshot as BoardSnapshot;
      } catch (e) {
        console.error("board_snapshot 파싱 에러:", e);
      }
    }

    return successResponse({
      data: {
        id: gameSession.id,
        status: gameSession.status,
        board_snapshot: boardSnapshot,
        completed_lines: gameSession.lines_cleared || 0,
        total_score: gameSession.total_score || 0,
        started_at: gameSession.started_at,
        ended_at: gameSession.ended_at,
        // 하위 호환성: board_state, current_pieces
        board_state: boardSnapshot?.board || null,
        current_pieces: boardSnapshot?.availableBlocks?.map((b) => b.block_type) || null,
      },
    });
  } catch (error) {
    console.error("게임 세션 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 게임 세션 생성/업데이트 API
 * POST /api/party/[partyId]/game-session
 */
export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const { partyId } = await params;
    const body = await request.json();
    const {
      teamId,
      action, // 'request', 'start', 'begin', 'finish', 'update'
      status,
      boardSnapshot,
      totalScore,
      completedLines,
    } = body;

    if (!teamId) {
      return errorResponse("teamId가 필요합니다", 400);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    const supabase = userRole === "admin" ? createAdminClient() : await createServerClient();

    // action에 따른 처리
    if (action === "request") {
      // 팀장이 게임 시작 요청: status='pending'
      // 팀장인지 확인 (teams.leader_id === userId)
      const teamResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("teams")
          .select("leader_id")
          .eq("id", teamId)
          .eq("party_id", partyId)
          .single();
      });

      if (!teamResult.success || !teamResult.data) {
        return errorResponse("팀 정보를 찾을 수 없습니다", 404);
      }

      if (teamResult.data.leader_id !== userId) {
        return errorResponse("팀장만 게임 시작을 요청할 수 있습니다", 403);
      }

      // 이미 pending 상태의 게임 세션이 있는지 확인
      const existingSessionResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .select("id")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .eq("status", "pending")
          .maybeSingle();
      });

      if (existingSessionResult.success && existingSessionResult.data) {
        return errorResponse("이미 게임 시작 요청이 대기 중입니다", 400);
      }

      const { data, error } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .insert({
            party_id: partyId,
            team_id: teamId,
            game_type: "tetris",
            status: "pending" as GameStatus,
            started_by_admin_id: userId, // 요청한 팀장 ID (실제 승인 시 관리자 ID로 업데이트될 예정)
            lines_cleared: 0,
            special_blocks_used: 0,
            total_score: 0,
          })
          .select()
          .single();
      });

      if (error) {
        return errorResponse(error.message || "게임 시작 요청에 실패했습니다", 500);
      }

      return successResponse({ data });
    }

    if (action === "start") {
      // 관리자가 게임 시작: status='pending' (더 이상 사용하지 않음, request 사용)
      // 호환성을 위해 유지하지만 request와 동일하게 처리
      return errorResponse("팀장이 게임 시작을 요청하도록 변경되었습니다", 400);
    }

    if (action === "begin") {
      // 팀장이 게임 시작: status='running', board_snapshot 설정
      // 먼저 pending 상태의 게임 세션이 있는지 확인
      const { data: existingSession } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .select("id")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      });

      if (!existingSession?.data) {
        return errorResponse("시작할 게임 세션을 찾을 수 없습니다", 404);
      }

      // board_snapshot 생성
      const snapshot: BoardSnapshot = boardSnapshot || {
        board: Array(20)
          .fill(null)
          .map(() => Array(10).fill(null)),
        availableBlocks: [],
      };

      // 팀 블럭 조회하여 availableBlocks 설정
      const blocksResult = await executeSupabaseQuery<
        Array<{
          id: string;
          block_type: string;
          value: number;
        }>
      >(async () => {
        return await supabase
          .from("team_block_events")
          .select("id, block_type, value")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .is("game_session_id", null)
          .order("created_at", { ascending: true });
      });

      const gameSessionId = existingSession.data?.id;
      if (!gameSessionId) {
        return errorResponse("게임 세션 ID를 찾을 수 없습니다", 404);
      }

      const blockIdsToMark: string[] = [];

      if (blocksResult.success && blocksResult.data) {
        const expandedBlocks: Array<{ id: string; block_type: string }> = [];
        blocksResult.data.forEach((block) => {
          const count = block.value || 1;
          // 이 블럭을 게임 세션에 사용할 것이므로 마킹할 ID 수집
          blockIdsToMark.push(block.id);
          for (let i = 0; i < count; i++) {
            expandedBlocks.push({
              id: `${block.id}-${i}`, // "team_block_events.id-index" 형식
              block_type: block.block_type || "",
            });
          }
        });
        snapshot.availableBlocks = expandedBlocks;

        // 게임 시작 시 사용할 블럭들을 game_session_id로 마킹
        // 이렇게 하면 게임 종료 후 새로 승인받은 블럭만 조회됨
        if (blockIdsToMark.length > 0) {
          const { error: markError } = await supabase
            .from("team_block_events")
            .update({ game_session_id: gameSessionId })
            .in("id", blockIdsToMark)
            .eq("party_id", partyId)
            .eq("team_id", teamId)
            .is("game_session_id", null);

          if (markError) {
            console.error("게임 시작 시 블럭 마킹 실패:", markError);
            // 블럭 마킹 실패해도 게임은 진행 가능하도록 계속 진행
          }
        }
      }

      const { data, error } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update({
            status: "running" as GameStatus,
            started_at: new Date().toISOString(),
            board_snapshot: snapshot,
          })
          .eq("id", gameSessionId)
          .select()
          .single();
      });

      if (error) {
        return errorResponse(error.message || "게임 시작에 실패했습니다", 500);
      }

      return successResponse({ data });
    }

    if (action === "finish") {
      // 게임 종료: status='finished', total_score 저장, 사용한 블럭들을 game_session_id로 마킹
      const { data: existingSession } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .select("id, board_snapshot")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .eq("status", "running")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      });

      if (!existingSession?.success || !existingSession.data) {
        return errorResponse("종료할 게임 세션을 찾을 수 없습니다", 404);
      }

      const gameSessionId = existingSession.data.id;

      const finalSnapshot: BoardSnapshot = boardSnapshot || {
        board: Array(20)
          .fill(null)
          .map(() => Array(10).fill(null)),
        availableBlocks: [],
      };

      // 게임 시작 시 이미 사용할 블럭들을 game_session_id로 마킹했으므로,
      // 게임 종료 시에는 별도로 블럭을 마킹할 필요가 없음
      // 남은 블럭들은 이미 game_session_id로 마킹되어 있으므로,
      // 새 게임에서는 game_session_id IS NULL인 블럭들(새로 승인받은 블럭)만 조회됨

      const { data, error } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update({
            status: "finished" as GameStatus,
            ended_at: new Date().toISOString(),
            total_score: totalScore || 0,
            lines_cleared: completedLines || 0,
            board_snapshot: finalSnapshot,
          })
          .eq("id", gameSessionId)
          .select()
          .single();
      });

      if (error) {
        return errorResponse(error.message || "게임 종료에 실패했습니다", 500);
      }

      return successResponse({ data });
    }

    if (action === "update") {
      // 게임 진행 중 업데이트: board_snapshot만 업데이트
      const { data: existingSession } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .select("id")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .eq("status", "running")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      });

      if (!existingSession?.data) {
        return errorResponse("업데이트할 게임 세션을 찾을 수 없습니다", 404);
      }

      if (!boardSnapshot) {
        return errorResponse("boardSnapshot이 필요합니다", 400);
      }

      const { data, error } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update({
            board_snapshot: boardSnapshot,
            lines_cleared: completedLines || 0,
            total_score: totalScore || 0,
          })
          .eq("id", existingSession.data.id)
          .select()
          .single();
      });

      if (error) {
        return errorResponse(error.message || "게임 세션 업데이트에 실패했습니다", 500);
      }

      return successResponse({ data });
    }

    return errorResponse("잘못된 action입니다", 400);
  } catch (error) {
    console.error("게임 세션 생성/업데이트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
