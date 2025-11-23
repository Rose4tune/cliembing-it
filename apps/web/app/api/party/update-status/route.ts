import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import type { PartyStatus } from "@pkg/shared";

/**
 * 파티 상태 업데이트 API
 * PATCH /api/party/update-status
 *
 * 요구사항:
 * - 관리자 권한 필요 (role = 'admin')
 */
export async function PATCH(request: Request) {
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

    // 2. 관리자 권한 확인
    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("파티 상태 변경은 관리자만 가능합니다", 403);
    }

    // 3. 요청 데이터 파싱
    const body = await request.json();
    const { partyId, status } = body;

    if (!partyId || !status) {
      return errorResponse("partyId와 status가 필요합니다", 400);
    }

    // 4. 상태 값 검증
    const validStatuses: PartyStatus[] = [
      "draft",
      "ready",
      "running",
      "paused",
      "ended",
      "archived",
    ];
    if (!validStatuses.includes(status)) {
      return errorResponse(`유효하지 않은 상태입니다. 가능한 값: ${validStatuses.join(", ")}`, 400);
    }

    // 5. Supabase 클라이언트 생성 (관리자 권한이 있으므로 관리자 클라이언트 사용)
    let supabase;
    try {
      supabase = createAdminClient();
    } catch (error) {
      // Service Role Key가 없으면 일반 클라이언트 사용 (RLS 정책 적용)
      supabase = await createServerClient();
    }

    // 6. 파티 존재 확인
    const { data: party, error: fetchError } = await supabase
      .from("parties")
      .select("id, status, end_at")
      .eq("id", partyId)
      .single();

    if (fetchError || !party) {
      return errorResponse("파티를 찾을 수 없습니다", 404);
    }

    // 7. 상태 업데이트
    const updateData: { status: PartyStatus; end_at?: string } = {
      status,
    };

    // 종료 상태로 변경 시 end_at 설정
    if (status === "ended" && !party.end_at) {
      updateData.end_at = new Date().toISOString();
    }

    const result = await executeSupabaseQuery(async () => {
      return await supabase.from("parties").update(updateData).eq("id", partyId).select().single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "파티 상태 업데이트에 실패했습니다", 500);
    }

    return successResponse({
      party: result.data,
      message: "파티 상태가 업데이트되었습니다",
    });
  } catch (error) {
    console.error("파티 상태 업데이트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
