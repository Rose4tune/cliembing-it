import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 사용자 권한 정보 조회 API
 * GET /api/user/permissions?partyId=xxx (선택)
 *
 * 반환:
 * - isAdmin: 관리자 여부 (users.role = 'admin')
 * - isStaff: 특정 파티에서 스탭 권한 여부 (partyId가 있을 때만)
 * - canCreateParty: 파티 생성 가능 여부
 * - canManagePermissions: 권한 관리 가능 여부
 */
export async function GET(request: Request) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    // 2. 쿼리 파라미터 확인
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");

    // 3. Supabase 클라이언트 생성
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

    // 4. 관리자 확인
    const isAdmin = userRole === "admin";

    // 5. 스탭 확인 (partyId가 있을 때만)
    let isStaff = false;
    if (partyId) {
      const { data: partyMember } = await supabaseForQuery
        .from("party_members")
        .select("role")
        .eq("party_id", partyId)
        .eq("user_id", userId)
        .maybeSingle();

      // party_members.role이 'staff' 또는 'admin'이면 스탭 권한
      isStaff = partyMember?.role === "staff" || partyMember?.role === "admin";
    }

    // 6. 권한 계산
    const canCreateParty = isAdmin;
    const canManagePermissions = isAdmin;

    return successResponse({
      isAdmin,
      isStaff,
      canCreateParty,
      canManagePermissions,
    });
  } catch (error) {
    console.error("권한 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
