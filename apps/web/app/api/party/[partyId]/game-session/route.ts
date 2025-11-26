import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

type GameStatus =
  | "inactive"
  | "idle"
  | "pending"
  | "requesting"
  | "ready"
  | "running"
  | "finished"
  | "cancelled";

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

    // 개발 단계: RLS 문제로 인해 Admin 클라이언트 사용
    // Supabase Admin 클라이언트 = Service Role Key 사용, RLS 정책 우회
    // 파티 admin 역할과는 별개 (애플리케이션 레벨 권한)
    const supabase = createAdminClient();

    // 권한 확인: 애플리케이션 레벨에서 팀 멤버인지 확인 (Admin 클라이언트로)
    const teamMemberCheck = await supabase
      .from("team_members")
      .select("team_id, user_id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!teamMemberCheck.data) {
      // 팀 멤버가 아니면 접근 거부
      return errorResponse("해당 팀의 멤버만 게임 세션에 접근할 수 있습니다", 403);
    }

    // 모든 게임 세션 조회 (상태 우선순위로 선택)
    const { data: allSessions, error: queryError } = await executeSupabaseQuery(async () => {
      return await supabase
        .from("game_sessions")
        .select("*")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .order("id", { ascending: false });
    });

    if (queryError) {
      console.error("❌ [게임 세션 조회 에러]", queryError);
      return errorResponse(queryError.message || "게임 세션 조회에 실패했습니다", 500);
    }

    if (!allSessions || allSessions.length === 0) {
      return errorResponse(
        `게임 세션을 찾을 수 없습니다. (partyId: ${partyId}, teamId: ${teamId}) 팀 생성 시 게임 세션이 자동으로 생성되어야 합니다.`,
        404,
      );
    }

    // 상태 우선순위에 따라 게임 세션 선택
    const statusPriority: Record<string, number> = {
      running: 1,
      ready: 2,
      requesting: 3,
      pending: 4,
      inactive: 5,
      idle: 6,
      finished: 7,
      cancelled: 7,
    };

    // 우선순위에 따라 정렬 (낮은 숫자가 높은 우선순위)
    const sortedSessions = allSessions.sort((a, b) => {
      const aPriority = statusPriority[a.status] || 999;
      const bPriority = statusPriority[b.status] || 999;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      // 같은 우선순위면 최신 것 (id가 큰 것)
      return (b.id as string).localeCompare(a.id as string);
    });

    const gameSession = sortedSessions[0];

    console.log("🔍 [선택된 게임 세션]", {
      selectedStatus: gameSession.status,
      selectedId: gameSession.id,
      totalSessions: allSessions.length,
    });

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

    // 개발 단계: RLS 문제로 인해 Admin 클라이언트 사용
    const supabase = createAdminClient();

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

      // 게임 승인 요청: 팀 생성 시 이미 게임 세션이 생성되어 있으므로,
      // 기존 세션의 상태를 확인하고 'idle' 또는 다른 상태에서 'pending'으로 변경
      // 같은 팀은 하나의 활성 게임 세션만 재사용

      // 기존 게임 세션 조회 (모든 상태 포함)
      const existingSessionResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .select("*")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .order("id", { ascending: false }) // 최신 세션 조회
          .limit(1)
          .maybeSingle();
      });

      if (!existingSessionResult.success || !existingSessionResult.data) {
        // 게임 세션이 없으면 에러 (팀 생성 시 만들어져야 함)
        return errorResponse("게임 세션을 찾을 수 없습니다. 팀 관리자에게 문의하세요.", 404);
      }

      const existingSession = existingSessionResult.data;

      // 파티 상태 확인 (파티가 진행 중이어야 게임 시작 요청 가능)
      const partyResult = await executeSupabaseQuery(async () => {
        return await supabase.from("parties").select("status").eq("id", partyId).single();
      });

      if (!partyResult.success || !partyResult.data) {
        return errorResponse("파티 정보를 찾을 수 없습니다", 404);
      }

      const partyStatus = partyResult.data.status;
      if (partyStatus !== "running") {
        return errorResponse(`파티가 진행 중이 아닙니다. 현재 파티 상태: ${partyStatus}`, 400);
      }

      // 세션 상태에 따른 처리
      if (existingSession.status === "requesting") {
        // 이미 requesting 상태면 그대로 반환 (승인 대기 중)
        return successResponse({
          data: existingSession,
          message: "이미 게임 시작 요청이 대기 중입니다",
        });
      } else if (existingSession.status === "ready") {
        // ready 상태는 관리자가 이미 승인한 상태
        return successResponse({
          data: existingSession,
          message: "이미 승인된 게임 세션이 있습니다",
        });
      } else if (existingSession.status === "running") {
        // running 상태는 이미 게임이 진행 중
        return successResponse({
          data: existingSession,
          message: "이미 게임이 진행 중입니다",
        });
      } else if (existingSession.status === "inactive") {
        // inactive 상태는 초기 상태이므로 게임 시작 요청 가능
        // inactive → requesting으로 변경 (승인 대기 상태)
        const updateResult = await executeSupabaseQuery(async () => {
          return await supabase
            .from("game_sessions")
            .update({
              status: "requesting" as GameStatus,
            })
            .eq("id", existingSession.id)
            .select()
            .single();
        });

        if (!updateResult.success || !updateResult.data) {
          return errorResponse("게임 세션 상태 변경에 실패했습니다", 500);
        }

        return successResponse({
          data: updateResult.data,
          message: "게임 시작 요청이 전송되었습니다",
        });
      } else if (existingSession.status === "pending") {
        // pending 상태는 비활성화 상태 (팀 삭제됨)이므로 재요청 불가
        return errorResponse("게임 세션이 비활성화되어 있습니다. 팀 관리자에게 문의하세요.", 403);
      } else if (existingSession.status === "idle") {
        // idle 상태는 비활성 상태 (팀 삭제 등)이므로 재요청 불가
        return errorResponse("게임 세션이 비활성화되어 있습니다. 팀 관리자에게 문의하세요.", 403);
      } else if (existingSession.status === "finished") {
        // finished 상태는 파티 종료 시에만 나타나므로 재요청 불가
        return errorResponse("파티가 종료되어 게임을 시작할 수 없습니다", 400);
      } else if (existingSession.status === "cancelled") {
        // cancelled 상태는 파티 종료 시에만 나타나므로 재요청 불가
        return errorResponse("파티가 종료되어 게임을 시작할 수 없습니다", 400);
      }

      // 예상하지 못한 상태
      return errorResponse(`알 수 없는 게임 세션 상태: ${existingSession.status}`, 500);
    }

    if (action === "start") {
      // 관리자가 게임 시작: status='pending' (더 이상 사용하지 않음, request 사용)
      // 호환성을 위해 유지하지만 request와 동일하게 처리
      return errorResponse("팀장이 게임 시작을 요청하도록 변경되었습니다", 400);
    }

    if (action === "begin") {
      // 팀장이 게임 시작: ready → running, board_snapshot 설정
      // ready 상태에서 running으로 변경 (관리자 승인 완료, 참가자 게임 시작)
      const { data: existingSession } = await executeSupabaseQuery(async () => {
        // 먼저 running 상태 조회 (이미 게임이 시작된 경우)
        const runningSession = await supabase
          .from("game_sessions")
          .select("id, status")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .eq("status", "running")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (runningSession.data) {
          return runningSession;
        }

        // running이 없으면 ready 조회 (관리자 승인 완료, 게임 시작 대기)
        return await supabase
          .from("game_sessions")
          .select("id, status")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .eq("status", "ready")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
      });

      if (!existingSession?.data) {
        return errorResponse(
          "시작할 게임 세션을 찾을 수 없습니다. 관리자 승인을 기다려주세요.",
          404,
        );
      }

      const isAlreadyRunning = existingSession.data.status === "running";

      // ready 상태가 아니고 running도 아니면 에러
      if (!isAlreadyRunning && existingSession.data.status !== "ready") {
        return errorResponse(
          `게임을 시작할 수 없습니다. 현재 상태: ${existingSession.data.status}`,
          400,
        );
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
          .order("id", { ascending: true }); // team_block_events.created_at은 있지만, id로 정렬해도 무방
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

      // 이미 running 상태이면 board_snapshot만 업데이트, 아니면 status와 started_at도 업데이트
      const updateData: {
        status?: GameStatus;
        started_at?: string;
        board_snapshot: BoardSnapshot;
      } = {
        board_snapshot: snapshot,
      };

      if (!isAlreadyRunning) {
        // ready 상태이면 running으로 변경하고 started_at 설정
        updateData.status = "running" as GameStatus;
        updateData.started_at = new Date().toISOString();
      }

      const { data, error } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update(updateData)
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
          .order("id", { ascending: false }) // created_at 컬럼이 없으므로 id로 정렬
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

      // 파티 상태 확인: 파티가 진행 중이면 pending으로, 아니면 finished로 변경
      const partyResult = await executeSupabaseQuery(async () => {
        return await supabase.from("parties").select("status").eq("id", partyId).single();
      });

      const partyStatus = partyResult.success && partyResult.data ? partyResult.data.status : null;
      // 파티가 진행 중이면 pending으로 변경 (재요청 가능), 아니면 finished로 변경
      const newStatus =
        partyStatus === "running" ? ("pending" as GameStatus) : ("finished" as GameStatus);

      const { data, error } = await executeSupabaseQuery(async () => {
        const updateData: {
          status: GameStatus;
          ended_at?: string | null;
          total_score: number;
          lines_cleared: number;
          board_snapshot: any;
        } = {
          status: newStatus,
          total_score: totalScore || 0,
          lines_cleared: completedLines || 0,
          board_snapshot: finalSnapshot,
        };

        // finished 상태일 때만 ended_at 설정, pending이면 null로 유지
        if (newStatus === "finished") {
          updateData.ended_at = new Date().toISOString();
        }

        return await supabase
          .from("game_sessions")
          .update(updateData)
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
          .order("id", { ascending: false }) // created_at 컬럼이 없으므로 id로 정렬
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

    if (action === "cancel") {
      // 팀장이 게임 요청 취소: status='pending'인 게임 세션을 'cancelled'로 변경
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
        return errorResponse("팀장만 게임 요청을 취소할 수 있습니다", 403);
      }

      // requesting, ready 상태의 게임 세션 취소 가능
      // (게임 시작 전까지 취소 가능, running 상태는 이미 시작되어 취소 불가)
      // 먼저 취소할 게임 세션을 찾음
      const findSessionResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .select("id")
          .eq("party_id", partyId)
          .eq("team_id", teamId)
          .in("status", ["requesting", "ready"])
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
      });

      if (!findSessionResult.success || !findSessionResult.data) {
        return errorResponse("취소할 게임 요청을 찾을 수 없습니다", 404);
      }

      const sessionId = findSessionResult.data.id;

      // 찾은 게임 세션을 cancelled 또는 pending으로 업데이트
      // ready 상태에서 취소: 파티 진행 중이면 pending으로, 아니면 cancelled로 변경
      // requesting 상태에서 취소: 파티 진행 중이면 pending으로, 아니면 cancelled로 변경
      const partyResult = await executeSupabaseQuery(async () => {
        return await supabase.from("parties").select("status").eq("id", partyId).single();
      });

      const partyStatus = partyResult.success && partyResult.data ? partyResult.data.status : null;
      // 파티가 진행 중이면 pending으로 변경 (비활성화), 아니면 cancelled로 변경 (파티 종료)
      const newStatus =
        partyStatus === "running" ? ("pending" as GameStatus) : ("cancelled" as GameStatus);

      const { data, error } = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update({
            status: newStatus,
          })
          .eq("id", sessionId)
          .select()
          .single();
      });

      if (error) {
        console.error("게임 세션 취소 에러:", error);
        return errorResponse(error.message || "게임 요청 취소에 실패했습니다", 500);
      }

      if (!data) {
        return errorResponse("게임 요청 취소에 실패했습니다", 500);
      }

      return successResponse({
        data,
        message: "게임 요청이 취소되었습니다",
      });
    }

    return errorResponse("잘못된 action입니다", 400);
  } catch (error) {
    console.error("게임 세션 생성/업데이트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
