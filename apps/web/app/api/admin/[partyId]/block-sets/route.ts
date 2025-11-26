import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 블럭 Set 할당 조회 API
 * GET /api/admin/[partyId]/block-sets
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

    // 파티 멤버 목록 조회 (팀별 그룹핑)
    const membersResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .select(
          `
          user_id,
          level,
          team_id,
          teams:team_id(id, name),
          users:user_id(id, nickname)
        `,
        )
        .eq("party_id", partyId)
        .order("team_id", { ascending: true });
    });

    if (!membersResult.success || !membersResult.data) {
      return successResponse({ members: [] });
    }

    // 블럭 Set 할당 조회
    const blockSetsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_member_block_sets")
        .select("user_id, set_number")
        .eq("party_id", partyId);
    });

    const blockSetMap = new Map<string, number>();
    if (blockSetsResult.success && blockSetsResult.data) {
      blockSetsResult.data.forEach((bs: any) => {
        blockSetMap.set(bs.user_id, bs.set_number);
      });
    }

    // 팀별로 그룹핑
    const teamsMap = new Map<
      string,
      {
        id: string;
        name: string;
        members: Array<{
          userId: string;
          nickname: string;
          level: string;
          assignedSet: number | null;
        }>;
      }
    >();

    membersResult.data.forEach((member: any) => {
      const teamId = member.team_id;
      if (!teamId) return;

      if (!teamsMap.has(teamId)) {
        teamsMap.set(teamId, {
          id: teamId,
          name: member.teams?.name || "알 수 없음",
          members: [],
        });
      }

      const team = teamsMap.get(teamId)!;
      team.members.push({
        userId: member.user_id,
        nickname: member.users?.nickname || "알 수 없음",
        level: member.level || "",
        assignedSet: blockSetMap.get(member.user_id) || null,
      });
    });

    return successResponse({
      teams: Array.from(teamsMap.values()),
    });
  } catch (error) {
    console.error("블럭 Set 할당 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 블럭 Set 할당 저장 API
 * POST /api/admin/[partyId]/block-sets
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
    const { assignments } = body; // [{ userId, setNumber }, ...]

    if (!Array.isArray(assignments)) {
      return errorResponse("assignments 배열이 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // 파티 상태 확인 (시작 전에만 설정 가능)
    const partyResult = await executeSupabaseQuery(async () => {
      return await supabase.from("parties").select("status").eq("id", partyId).single();
    });

    if (!partyResult.success || !partyResult.data) {
      return errorResponse("파티를 찾을 수 없습니다", 404);
    }

    const partyStatus = partyResult.data.status;
    // draft, ready 상태에서만 블럭 Set 변경 가능 (대기 중 상태)
    if (partyStatus !== "draft" && partyStatus !== "ready") {
      return errorResponse("파티가 시작된 후에는 블럭 Set을 변경할 수 없습니다", 400);
    }

    // 각 할당에 대해 upsert
    const upsertResults = await Promise.all(
      assignments.map(async (assignment: { userId: string; setNumber: number | null }) => {
        if (!assignment.userId) {
          return { success: false, error: "userId가 필요합니다" };
        }

        if (assignment.setNumber === null) {
          // null인 경우 삭제
          return await executeSupabaseQuery(async () => {
            return await supabase
              .from("party_member_block_sets")
              .delete()
              .eq("party_id", partyId)
              .eq("user_id", assignment.userId);
          });
        }

        // 유효성 검사: setNumber는 1~5
        if (assignment.setNumber < 1 || assignment.setNumber > 5) {
          return { success: false, error: "setNumber는 1~5 사이여야 합니다" };
        }

        return await executeSupabaseQuery(async () => {
          return await supabase.from("party_member_block_sets").upsert(
            {
              party_id: partyId,
              user_id: assignment.userId,
              set_number: assignment.setNumber,
            },
            {
              onConflict: "party_id,user_id",
            },
          );
        });
      }),
    );

    // 실패한 할당이 있는지 확인
    const failedAssignments = upsertResults.filter((r) => !r.success);
    if (failedAssignments.length > 0) {
      console.error("일부 블럭 Set 할당 실패:", failedAssignments);
      return errorResponse("일부 블럭 Set 할당에 실패했습니다", 500);
    }

    return successResponse({ message: "블럭 Set 할당이 완료되었습니다" });
  } catch (error) {
    console.error("블럭 Set 할당 저장 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
