import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 특정 파티에서 사용자의 권한 확인 API
 * GET /api/party/[partyId]/permissions
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
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

    const { partyId } = await params;
    if (!partyId) {
      return errorResponse("파티 ID가 필요합니다", 400);
    }

    console.log("권한 확인 요청:", { userId, partyId });

    // 2. Supabase 클라이언트 생성
    const userRole = (session.user as { role?: string | null })?.role;
    console.log("사용자 역할:", userRole);
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

    // 3. 파티 멤버 정보 조회 (데이터가 없을 수 있으므로 single() 대신 maybeSingle() 사용)
    const { data: partyMember, error: memberError } = await supabase
      .from("party_members")
      .select("role")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .maybeSingle();

    // memberError는 데이터가 없을 때도 발생할 수 있으므로 무시 (PGRST116은 "not found" 에러)
    if (memberError && memberError.code !== "PGRST116") {
      console.error("파티 멤버 조회 에러:", memberError);
    }

    // 4. 파티 정보 조회 (created_by 확인)
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("created_by, status")
      .eq("id", partyId)
      .single();

    if (partyError || !party) {
      return errorResponse("파티를 찾을 수 없습니다", 404);
    }

    // 5. 권한 계산
    const isPartyCreator = party.created_by === userId;
    const isAdmin = userRole === "admin";
    const isStaff = partyMember?.role === "staff" || partyMember?.role === "admin";
    const isParticipant = !!partyMember;

    // 관리자/스탭 화면 접근 가능 여부
    const canAccessAdminView = isAdmin || isStaff || isPartyCreator;

    console.log("권한 계산 결과:", {
      isPartyCreator,
      isAdmin,
      isStaff,
      isParticipant,
      canAccessAdminView,
      partyStatus: party.status,
    });

    return successResponse({
      isPartyCreator,
      isAdmin,
      isStaff,
      isParticipant,
      canAccessAdminView,
      partyStatus: party.status,
    });
  } catch (error) {
    console.error("파티 권한 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
