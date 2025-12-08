import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 멤버 정보 조회 API
 * GET /api/party/[partyId]/member
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

    // 파티 멤버 정보 조회 (Service Role Key 사용)
    const result = await executeSupabaseQuery<{
      level: string | null;
      team_id: string | null;
    }>(async () => {
      return await supabaseForQuery
        .from("party_members")
        .select("level, team_id")
        .eq("party_id", partyId)
        .eq("user_id", userId)
        .maybeSingle();
    });

    if (!result.success || !result.data) {
      return errorResponse("파티 멤버 정보를 찾을 수 없습니다", 404);
    }

    const memberData = result.data as { team_id: string | null; [key: string]: any };

    // team_id가 있으면 teams 테이블에서 팀 이름 및 팀장 정보 조회 (Service Role Key 사용)
    let teamName = null;
    let isLeader = false;
    if (memberData.team_id) {
      const teamResult = await executeSupabaseQuery(async () => {
        return await supabaseForQuery
          .from("teams")
          .select("name, leader_id")
          .eq("id", memberData.team_id!)
          .maybeSingle();
      });

      if (teamResult.success && teamResult.data) {
        const team = teamResult.data as { name: string; leader_id: string };
        teamName = team.name;
        isLeader = team.leader_id === userId;
      }
    }

    return successResponse({
      level: result.data.level || null,
      team_id: result.data.team_id || null,
      team_name: teamName,
      is_leader: isLeader,
    });
  } catch (error) {
    console.error("멤버 정보 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
