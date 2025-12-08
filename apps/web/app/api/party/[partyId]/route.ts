import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 정보 조회 API
 * GET /api/party/[partyId]
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
): Promise<Response> {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const { partyId } = await params;
    if (!partyId) {
      return errorResponse("파티 ID가 필요합니다", 400);
    }

    // 2. Supabase 클라이언트 생성
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // parties 조회 시 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // parties 조회는 Service Role Key 사용 (RLS 우회)
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

    // 3. 파티 정보 조회 (Service Role Key 사용)
    const result = await executeSupabaseQuery(async () => {
      return await supabaseForQuery.from("parties").select("*").eq("id", partyId).single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "파티를 찾을 수 없습니다", 404);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("파티 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
