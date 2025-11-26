import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티의 팀 목록 조회 API (관리자용)
 * GET /api/admin/[partyId]/teams
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const { partyId } = await params;
    const supabase = createAdminClient();

    // 파티의 팀 목록 조회 (leader_id 포함)
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("teams")
        .select("id, name, color, score, leader_id")
        .eq("party_id", partyId)
        .order("name", { ascending: true });
    });

    if (!result.success || !result.data) {
      return successResponse([]);
    }

    // 각 팀의 멤버 수 및 멤버 목록 조회
    const teamsWithMembers = await Promise.all(
      result.data.map(async (team: any) => {
        // 멤버 수 조회
        const memberCountResult = await executeSupabaseQuery(async () => {
          const { count, error } = await supabase
            .from("team_members")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);

          return { data: count, error };
        });

        // 멤버 목록 조회 (팀장 설정용)
        const membersResult = await executeSupabaseQuery(async () => {
          return await supabase
            .from("team_members")
            .select(
              `
              user_id,
              users:user_id(id, nickname)
            `,
            )
            .eq("team_id", team.id);
        });

        const members =
          membersResult.success && membersResult.data
            ? membersResult.data.map((m: any) => ({
                id: m.user_id,
                nickname: m.users?.nickname || "알 수 없음",
              }))
            : [];

        return {
          ...team,
          memberCount:
            memberCountResult.success && memberCountResult.data !== null
              ? memberCountResult.data
              : 0,
          members,
        };
      }),
    );

    if (!result.success) {
      console.error("팀 목록 조회 실패:", result.error);
      return errorResponse(result.error?.message || "팀 목록을 불러올 수 없습니다", 500);
    }

    return successResponse(teamsWithMembers);
  } catch (error) {
    console.error("팀 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 팀 생성 API (관리자용)
 * POST /api/admin/[partyId]/teams
 */
export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const { partyId } = await params;
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return errorResponse("팀 이름이 필요합니다", 400);
    }

    const supabase = createAdminClient();

    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("teams")
        .insert({
          party_id: partyId,
          name,
          color: color || null,
          score: 0,
        })
        .select()
        .single();
    });

    if (!result.success) {
      console.error("팀 생성 실패:", result.error);
      return errorResponse(result.error?.message || "팀을 생성할 수 없습니다", 500);
    }

    const newTeam = result.data;

    // 팀 생성 시 게임 세션도 함께 생성
    // 초기 상태는 'idle'로 하고 싶지만 스키마에 없으므로,
    // 일단 생성만 해두고 실제 사용 시 상태를 변경하는 방식 사용
    // 또는 별도 컬럼(is_active)을 추가하는 것을 고려할 수 있음
    // 현재는 'pending'을 초기 상태로 사용하되, 게임 승인 요청 시에만 활성화

    // 관리자 ID 조회 (started_by_admin_id 필수 필드)
    const adminResult = await executeSupabaseQuery(async () => {
      return await supabase.from("users").select("id").eq("role", "admin").limit(1).maybeSingle();
    });

    const adminUserId =
      adminResult.success && adminResult.data ? adminResult.data.id : session.user.id; // 관리자가 없으면 현재 사용자 ID 사용

    // 게임 세션 생성 (초기 상태: 'inactive' - 아직 게임 시작 요청 전)
    const gameSessionResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("game_sessions")
        .insert({
          party_id: partyId,
          team_id: newTeam.id,
          game_type: "tetris",
          status: "inactive" as any, // 초기 상태 (아직 게임 시작 요청 전)
          started_by_admin_id: adminUserId,
          lines_cleared: 0,
          special_blocks_used: 0,
          total_score: 0,
        })
        .select()
        .single();
    });

    if (!gameSessionResult.success) {
      console.error("게임 세션 생성 실패 (팀은 생성됨):", gameSessionResult.error);
      // 게임 세션 생성 실패해도 팀 생성은 성공한 것으로 처리
      // (나중에 수동으로 게임 세션을 생성할 수 있음)
    } else {
      console.log("✅ 팀 및 게임 세션 생성 완료:", {
        teamId: newTeam.id,
        gameSessionId: gameSessionResult.data?.id,
      });
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("팀 생성 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 팀 수정/삭제 API (관리자용)
 * PATCH /api/admin/[partyId]/teams
 * DELETE /api/admin/[partyId]/teams
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const { partyId } = await params;
    const body = await request.json();
    const { teamId, name, color, leaderId } = body;

    if (!teamId) {
      return errorResponse("팀 ID가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    const updateData: {
      name?: string;
      color?: string | null;
      leader_id?: string | null;
    } = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (color !== undefined) {
      updateData.color = color || null;
    }
    if (leaderId !== undefined) {
      // leaderId가 빈 문자열이거나 null이면 null로 설정
      updateData.leader_id = leaderId || null;
    }

    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("teams")
        .update(updateData)
        .eq("id", teamId)
        .eq("party_id", partyId)
        .select()
        .single();
    });

    if (!result.success) {
      console.error("팀 수정 실패:", result.error);
      return errorResponse(result.error?.message || "팀을 수정할 수 없습니다", 500);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("팀 수정 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const { partyId } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return errorResponse("팀 ID가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // 게임 세션 조회 (기록 확인용)
    const gameSessionResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("game_sessions")
        .select("id, total_score, lines_cleared, board_snapshot")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .maybeSingle();
    });

    // 게임 진행 기록 확인 (점수나 블럭 사용 기록이 있는지)
    const hasGameRecords =
      gameSessionResult.success &&
      gameSessionResult.data &&
      ((gameSessionResult.data.total_score && gameSessionResult.data.total_score > 0) ||
        (gameSessionResult.data.lines_cleared && gameSessionResult.data.lines_cleared > 0) ||
        gameSessionResult.data.board_snapshot);

    if (hasGameRecords) {
      // 게임 기록이 있으면 게임 세션을 완전 삭제하지 않고 비활성화
      // idle 상태로 변경 (팀 삭제로 인한 비활성화)
      const deactivateResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update({ status: "idle" as any }) // 팀 삭제로 인한 비활성화 상태
          .eq("party_id", partyId)
          .eq("team_id", teamId);
      });

      if (!deactivateResult.success) {
        console.warn("게임 세션 비활성화 실패 (팀 삭제는 계속 진행):", deactivateResult.error);
      }
    } else {
      // 게임 기록이 없으면 게임 세션 삭제
      const deleteSessionResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .delete()
          .eq("party_id", partyId)
          .eq("team_id", teamId);
      });

      if (!deleteSessionResult.success) {
        console.warn("게임 세션 삭제 실패 (팀 삭제는 계속 진행):", deleteSessionResult.error);
      }
    }

    // 팀 삭제
    const result = await executeSupabaseQuery(async () => {
      return await supabase.from("teams").delete().eq("id", teamId).eq("party_id", partyId);
    });

    if (!result.success) {
      console.error("팀 삭제 실패:", result.error);
      return errorResponse(result.error?.message || "팀을 삭제할 수 없습니다", 500);
    }

    return successResponse({ message: "팀이 삭제되었습니다" });
  } catch (error) {
    console.error("팀 삭제 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
