import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 사용자가 참여한 파티 목록 조회 API
 * GET /api/user/parties
 */
export async function GET() {
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

    // 2. Supabase 클라이언트 생성
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
      } else {
        supabase = await createServerClient();
      }
    } catch (error) {
      supabase = await createServerClient();
    }

    // 3. 참여한 파티 목록 조회 (party_members와 parties 조인)
    const { data: members, error: membersError } = await supabase
      .from("party_members")
      .select("party_id")
      .eq("user_id", userId);

    if (membersError) {
      return errorResponse(membersError.message || "파티 목록을 불러올 수 없습니다", 500);
    }

    if (!members || members.length === 0) {
      return successResponse({
        parties: [],
        count: 0,
      });
    }

    const partyIds = members.map((m) => m.party_id);

    // 4. 파티 정보 조회
    const partiesResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("parties")
        .select("*")
        .in("id", partyIds)
        .order("created_at", { ascending: false });
    });

    if (!partiesResult.success || !partiesResult.data) {
      return errorResponse(partiesResult.error?.message || "파티 정보를 불러올 수 없습니다", 500);
    }

    // 5. 각 파티별 참가자 수 조회
    const partiesWithCount = await Promise.all(
      partiesResult.data.map(async (party: any) => {
        const { count } = await supabase
          .from("party_members")
          .select("*", { count: "exact", head: true })
          .eq("party_id", party.id);

        return {
          ...party,
          participant_count: count || 0,
        };
      }),
    );

    return successResponse({
      parties: partiesWithCount,
      count: partiesWithCount.length,
    });
  } catch (error) {
    console.error("파티 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
