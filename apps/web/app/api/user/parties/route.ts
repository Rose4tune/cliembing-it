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
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // party_members, parties 조회 시 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // party_members, parties 조회는 Service Role Key 사용 (RLS 우회)
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

    // 3. 참여한 파티 목록 조회 (party_members와 parties 조인)
    const { data: members, error: membersError } = await supabaseForQuery
      .from("party_members")
      .select("party_id, team_id")
      .eq("user_id", userId);

    if (membersError) {
      console.error("party_members 조회 에러:", membersError);
      return errorResponse(membersError.message || "파티 목록을 불러올 수 없습니다", 500);
    }

    if (!members || members.length === 0) {
      return successResponse({
        parties: [],
        count: 0,
      });
    }

    const partyIds = members.map((m) => m.party_id).filter((id) => id != null);

    if (partyIds.length === 0) {
      return successResponse({
        parties: [],
        count: 0,
      });
    }

    // 4. 파티 정보 조회 (Service Role Key 사용)
    const partiesResult = await executeSupabaseQuery(async () => {
      return await supabaseForQuery
        .from("parties")
        .select("*")
        .in("id", partyIds)
        .order("created_at", { ascending: false });
    });

    if (!partiesResult.success || !partiesResult.data) {
      return errorResponse(partiesResult.error?.message || "파티 정보를 불러올 수 없습니다", 500);
    }

    // 5. 각 파티별 참가자 수 조회 및 사용자 팀 정보 추가
    // team_id가 있으면 teams 테이블에서 team 정보 조회 (Service Role Key 사용)
    const teamIds = members.map((m: any) => m.team_id).filter((id: any) => id != null);

    const teamMap = new Map();
    if (teamIds.length > 0) {
      const { data: teams, error: teamsError } = await supabaseForQuery
        .from("teams")
        .select("id, name")
        .in("id", teamIds);

      if (!teamsError && teams) {
        teams.forEach((team: any) => {
          teamMap.set(team.id, team);
        });
      }
    }

    const memberMap = new Map();
    members.forEach((member: any) => {
      const team = member.team_id ? teamMap.get(member.team_id) : null;
      memberMap.set(member.party_id, {
        team_id: member.team_id,
        team_name: team?.name || null,
      });
    });

    const partiesWithCount = await Promise.all(
      partiesResult.data.map(async (party: any) => {
        try {
          const { count, error: countError } = await supabaseForQuery
            .from("party_members")
            .select("*", { count: "exact", head: true })
            .eq("party_id", party.id);

          if (countError) {
            console.error(`파티 ${party.id} 참가자 수 조회 에러:`, countError);
          }

          const userMemberInfo = memberMap.get(party.id);

          return {
            ...party,
            participant_count: count || 0,
            user_team_id: userMemberInfo?.team_id ?? null,
            user_team_name: userMemberInfo?.team_name ?? null,
          };
        } catch (error) {
          console.error(`파티 ${party.id} 처리 중 에러:`, error);
          // 에러가 발생해도 기본값으로 반환
          const userMemberInfo = memberMap.get(party.id);
          return {
            ...party,
            participant_count: 0,
            user_team_id: userMemberInfo?.team_id ?? null,
            user_team_name: userMemberInfo?.team_name ?? null,
          };
        }
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
