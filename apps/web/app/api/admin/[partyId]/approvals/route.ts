import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 승인 대기 목록 조회 API (관리자용)
 * GET /api/admin/[partyId]/approvals
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

    // 점수 승인 대기 목록 조회 (approved가 NULL인 것만)
    const scoresResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select(
          `
          id,
          user_id,
          level,
          problem_count,
          score,
          created_at,
          updated_at,
          users:user_id (
            id,
            nickname,
            email
          )
        `,
        )
        .eq("party_id", partyId)
        .is("approved", null)
        .order("created_at", { ascending: false });
    });

    // 게임 요청 목록 조회
    // TODO: game_requests 테이블이 생성되면 해당 테이블 조회
    const gameRequests: any[] = [];

    return successResponse({
      scores: scoresResult.success ? scoresResult.data || [] : [],
      gameRequests: gameRequests,
    });
  } catch (error) {
    console.error("승인 대기 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 점수 승인 API (관리자용)
 * POST /api/admin/[partyId]/approvals
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
    const { scoreId, approved } = body;

    if (!scoreId || approved === undefined) {
      return errorResponse("점수 ID와 승인 상태가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // level_scores의 approved 컬럼 업데이트
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .update({ approved })
        .eq("id", scoreId)
        .eq("party_id", partyId)
        .select()
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "승인 상태 업데이트에 실패했습니다", 500);
    }

    return successResponse({
      scoreId,
      approved,
      message: "승인 상태가 업데이트되었습니다",
    });
  } catch (error) {
    console.error("점수 승인 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
