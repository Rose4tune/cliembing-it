import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 멤버 목록 조회 API (관리자용)
 * GET /api/admin/[partyId]/users
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

    // 파티 멤버 목록 조회
    const membersResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .select(
          "id, user_id, level, team_id, role, base_level_override, checkin_status, checked_in_at, joined_at",
        )
        .eq("party_id", partyId)
        .order("team_id", { ascending: true, nullsFirst: true })
        .order("joined_at", { ascending: true });
    });

    if (!membersResult.success) {
      console.error("멤버 목록 조회 실패:", membersResult.error);
      return errorResponse(membersResult.error?.message || "멤버 목록을 불러올 수 없습니다", 500);
    }

    if (!membersResult.data) {
      return successResponse([]);
    }

    // 유저 ID 목록 추출
    const userIds = membersResult.data.map((member: any) => member.user_id);

    if (userIds.length === 0) {
      return successResponse([]);
    }

    // 유저 정보 조회
    const usersResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("users")
        .select("id, nickname, email, base_level, mbti")
        .in("id", userIds);
    });

    if (!usersResult.success) {
      console.error("유저 정보 조회 실패:", usersResult.error);
      // 유저 정보 조회 실패해도 멤버 정보는 반환
    }

    // 팀 ID 목록 추출
    const teamIds = membersResult.data
      .map((member: any) => member.team_id)
      .filter((id: string | null) => id !== null);

    // 팀 정보 조회
    const teamsMap = new Map();
    if (teamIds.length > 0) {
      const teamsResult = await executeSupabaseQuery(async () => {
        return await supabase.from("teams").select("id, name, color").in("id", teamIds);
      });

      if (teamsResult.success && teamsResult.data) {
        teamsResult.data.forEach((team: any) => {
          teamsMap.set(team.id, team);
        });
      }
    }

    // 멤버와 유저 정보 결합
    const usersMap = new Map();
    if (usersResult.success && usersResult.data) {
      usersResult.data.forEach((user: any) => {
        usersMap.set(user.id, user);
      });
    }

    const membersWithUsers = membersResult.data.map((member: any) => ({
      ...member,
      users: usersMap.get(member.user_id) || {
        id: member.user_id,
        nickname: "알 수 없음",
        email: null,
        base_level: null,
        mbti: null,
      },
      team: member.team_id
        ? (() => {
            const team = teamsMap.get(member.team_id);
            return team
              ? {
                  id: team.id,
                  name: team.name,
                  color: team.color,
                }
              : null;
          })()
        : null,
    }));

    return successResponse(membersWithUsers);
  } catch (error) {
    console.error("멤버 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 파티 멤버 정보 업데이트 API (관리자용)
 * PATCH /api/admin/[partyId]/users
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
    const { memberId, level, teamId, role } = body;

    if (!memberId) {
      return errorResponse("멤버 ID가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // 업데이트할 데이터 준비
    const updateData: {
      level?: string | null;
      team_id?: string | null;
      role?: string;
    } = {};

    if (level !== undefined) {
      updateData.level = level || null;
    }
    if (teamId !== undefined) {
      updateData.team_id = teamId || null;
    }
    if (role !== undefined) {
      updateData.role = role;
    }

    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .update(updateData)
        .eq("id", memberId)
        .eq("party_id", partyId)
        .select()
        .single();
    });

    if (!result.success) {
      return errorResponse("멤버 정보를 업데이트할 수 없습니다", 500);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("멤버 정보 업데이트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
