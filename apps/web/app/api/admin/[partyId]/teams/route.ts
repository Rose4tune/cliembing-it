import { NextResponse } from "next/server";
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

    // 파티의 팀 목록 조회
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("teams")
        .select("id, name, number")
        .eq("party_id", partyId)
        .order("number", { ascending: true, nullsFirst: true });
    });

    if (!result.success) {
      console.error("팀 목록 조회 실패:", result.error);
      return errorResponse(result.error?.message || "팀 목록을 불러올 수 없습니다", 500);
    }

    return successResponse(result.data || []);
  } catch (error) {
    console.error("팀 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
