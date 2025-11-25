import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 룰셋 조회 API
 * GET /api/party/[partyId]/ruleset
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

    // Supabase 클라이언트 생성
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
      } else {
        supabase = await createServerClient();
      }
    } catch {
      supabase = await createServerClient();
    }

    // 파티 멤버 확인
    const { data: member } = await supabase
      .from("party_members")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .single();

    if (!member) {
      return errorResponse("파티에 참가하지 않았습니다", 403);
    }

    // party_ruleset 조회
    const rulesetResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_ruleset")
        .select("id, party_id, level_points")
        .eq("party_id", partyId)
        .single();
    });

    if (!rulesetResult.success || !rulesetResult.data) {
      return errorResponse("파티 룰셋을 찾을 수 없습니다", 404);
    }

    return successResponse({
      level_points: rulesetResult.data.level_points || null,
    });
  } catch (error) {
    console.error("룰셋 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
