import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 팀 점수 조회 API (테트리스 게임 점수 합산)
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

    // 개발 단계: RLS 문제로 인해 Admin 클라이언트 사용
    const supabase = createAdminClient();

    // 테트리스 게임 점수 합산 (완료된 게임만)
    const gameSessionsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("game_sessions")
        .select("team_score")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .eq("status", "finished");
    });

    if (!gameSessionsResult.success || !gameSessionsResult.data) {
      return successResponse({ teamScore: 0 });
    }

    const teamScore = gameSessionsResult.data.reduce(
      (sum: number, session: { team_score: number }) => sum + (session.team_score || 0),
      0,
    );

    return successResponse({ teamScore });
  } catch (error) {
    console.error("팀 점수 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
