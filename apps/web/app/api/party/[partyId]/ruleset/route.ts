import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 룰셋 조회 API
 * GET /api/party/[partyId]/ruleset
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

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    const { partyId } = await params;

    // Supabase 클라이언트 생성
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // party_members 조회 시 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // party_members 조회는 Service Role Key 사용 (RLS 우회)
        supabaseForQuery = createAdminClient();
        supabase = await createServerClient();
      }
    } catch (error) {
      console.error("Supabase 클라이언트 생성 에러:", error);
      try {
        supabaseForQuery = createAdminClient();
        supabase = await createServerClient();
      } catch (fallbackError) {
        console.error("Supabase 클라이언트 생성 실패:", fallbackError);
        return errorResponse("데이터베이스 연결에 실패했습니다", 500);
      }
    }

    if (!supabase || !supabaseForQuery) {
      return errorResponse("데이터베이스 연결에 실패했습니다", 500);
    }

    // 파티 멤버 확인 (Service Role Key 사용)
    const { data: member } = await supabaseForQuery
      .from("party_members")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .maybeSingle();

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

    const ruleset = rulesetResult.data as {
      level_points?: Record<string, number> | null;
    };

    return successResponse({
      level_points: ruleset.level_points || null,
    });
  } catch (error) {
    console.error("룰셋 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
