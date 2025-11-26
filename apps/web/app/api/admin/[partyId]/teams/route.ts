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
