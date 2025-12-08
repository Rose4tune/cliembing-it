import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 챌린지 기록 조회 API (관리자용)
 * GET /api/admin/[partyId]/challenges
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
): Promise<Response> {
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

    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .select("*")
        .eq("party_id", partyId)
        .order("created_at", { ascending: false });
    });

    if (!result.success) {
      return errorResponse(result.error?.message || "챌린지 기록을 불러올 수 없습니다", 500);
    }

    return successResponse(result.data || []);
  } catch (error) {
    console.error("챌린지 기록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 챌린지 기록 저장 API (관리자용)
 * POST /api/admin/[partyId]/challenges
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    const { partyId } = await params;
    const body = await request.json();
    const { teamNumber, time, challengeType } = body;

    if (!teamNumber || !time || !challengeType) {
      return errorResponse("팀 번호, 시간, 챌린지 유형이 필요합니다", 400);
    }

    const supabase = createAdminClient();

    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .insert({
          party_id: partyId,
          team_number: teamNumber,
          time,
          challenge_type: challengeType,
          recorded_by: userId,
        })
        .select()
        .single();
    });

    if (!result.success) {
      return errorResponse(result.error?.message || "챌린지 기록을 저장할 수 없습니다", 500);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("챌린지 기록 저장 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
