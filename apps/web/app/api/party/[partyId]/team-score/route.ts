import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 팀 점수 조회 API (승인된 점수만 합산)
 * GET /api/party/[partyId]/team-score?teamId=xxx
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    const { partyId } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return errorResponse("팀 ID가 필요합니다", 400);
    }

    // Supabase 클라이언트 생성
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
      } else {
        supabase = await createServerClient();
      }
    } catch (error) {
      supabase = await createServerClient();
    }

    // 팀 멤버 조회
    const teamMembersResult = await executeSupabaseQuery(async () => {
      return await supabase.from("team_members").select("user_id").eq("team_id", teamId);
    });

    if (!teamMembersResult.success || !teamMembersResult.data) {
      return successResponse({ teamScore: 0 });
    }

    const userIds = teamMembersResult.data.map((member: any) => member.user_id);

    if (userIds.length === 0) {
      return successResponse({ teamScore: 0 });
    }

    // 승인된 점수만 합산
    const scoresResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select("score")
        .eq("party_id", partyId)
        .eq("approved", true)
        .in("user_id", userIds);
    });

    if (!scoresResult.success || !scoresResult.data) {
      return successResponse({ teamScore: 0 });
    }

    const teamScore = scoresResult.data.reduce(
      (sum: number, item: any) => sum + (item.score || 0),
      0,
    );

    return successResponse({ teamScore });
  } catch (error) {
    console.error("팀 점수 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
