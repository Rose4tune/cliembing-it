import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 랭킹 조회 API (일반 사용자용)
 * GET /api/party/[partyId]/rankings
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

    // 개발 단계: RLS 문제로 인해 Admin 클라이언트 사용
    const supabase = createAdminClient();

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

    // 파티 정보 조회
    const partyResult = await executeSupabaseQuery<{
      id: string;
      name: string;
      status: string;
      start_at: string | null;
      end_at: string | null;
    }>(async () => {
      return await supabase
        .from("parties")
        .select("id, name, status, start_at, end_at")
        .eq("id", partyId)
        .single();
    });

    if (!partyResult.success || !partyResult.data) {
      return errorResponse("파티를 찾을 수 없습니다", 404);
    }

    const party = partyResult.data;

    // Supabase SQL 함수로 그룹별 랭킹 계산 (점수 높은 순으로 정렬)
    let cruxRankings: any[] = [];
    let gripRankings: any[] = [];
    let teamRankings: any[] = [];
    const challengeRankings: any[] = [];

    // Crux 그룹 랭킹 조회 (SQL 함수 사용)
    const cruxResult = await executeSupabaseQuery(async () => {
      return await supabase.rpc("get_crux_rankings", {
        p_party_id: partyId,
      });
    });

    if (cruxResult.success && cruxResult.data) {
      cruxRankings = cruxResult.data.map((item: any) => ({
        userId: item.user_id,
        nickname: item.nickname,
        teamId: item.team_id,
        teamName: item.team_name,
        totalScore: item.total_score || 0,
        rank: item.rank,
      }));
    }

    // Grip 그룹 랭킹 조회 (SQL 함수 사용)
    const gripResult = await executeSupabaseQuery(async () => {
      return await supabase.rpc("get_grip_rankings", {
        p_party_id: partyId,
      });
    });

    if (gripResult.success && gripResult.data) {
      gripRankings = gripResult.data.map((item: any) => ({
        userId: item.user_id,
        nickname: item.nickname,
        teamId: item.team_id,
        teamName: item.team_name,
        totalScore: item.total_score || 0,
        rank: item.rank,
      }));
    }

    // 개인 랭킹 (Crux + Grip 합쳐서 정렬) - SQL 함수 결과를 합치기만 함
    const personalRankings = [...cruxRankings, ...gripRankings]
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({
        ...item,
        rank: index + 1, // 전체 개인 랭킹 순위 재계산
      }));

    // 팀 랭킹이 없으면 game_sessions에서 계산
    if (teamRankings.length === 0) {
      // 모든 팀 조회
      const teamsResult = await executeSupabaseQuery(async () => {
        return await supabase.from("teams").select("id, name").eq("party_id", partyId);
      });

      if (teamsResult.success && teamsResult.data) {
        // 각 팀의 테트리스 게임 점수 합산
        const teamScoresPromises = teamsResult.data.map(
          async (team: { id: string; name: string }) => {
            const gameSessionsResult = await executeSupabaseQuery(async () => {
              return await supabase
                .from("game_sessions")
                .select("team_score")
                .eq("party_id", partyId)
                .eq("team_id", team.id)
                .eq("status", "finished");
            });

            const totalScore =
              gameSessionsResult.success && gameSessionsResult.data
                ? gameSessionsResult.data.reduce(
                    (sum: number, session: { team_score: number }) =>
                      sum + (session.team_score || 0),
                    0,
                  )
                : 0;

            return {
              teamId: team.id,
              teamName: team.name,
              totalScore,
            };
          },
        );

        const teamScores = await Promise.all(teamScoresPromises);
        teamRankings = teamScores
          .sort((a, b) => b.totalScore - a.totalScore)
          .map((item, index) => ({
            ...item,
            rank: index + 1,
          }));
      }
    }

    // 파티 참가자 수 및 팀 수 계산
    const participantCountResult = await executeSupabaseQuery(async () => {
      const { count } = await supabase
        .from("party_members")
        .select("*", { count: "exact", head: true })
        .eq("party_id", partyId);
      return { data: count, error: null };
    });

    const teamCountResult = await executeSupabaseQuery(async () => {
      const { count } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true })
        .eq("party_id", partyId);
      return { data: count, error: null };
    });

    // 남은 시간 계산
    let timeRemaining = null;
    let progress = 0;
    if (party.start_at && party.end_at) {
      const now = new Date();
      const start = new Date(party.start_at);
      const end = new Date(party.end_at);
      const total = end.getTime() - start.getTime();
      const remaining = end.getTime() - now.getTime();

      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        timeRemaining = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        progress = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
      } else {
        timeRemaining = "00:00:00";
        progress = 100;
      }
    }

    return successResponse({
      party: {
        id: party.id,
        name: party.name,
        status: party.status,
        participants: participantCountResult.success ? participantCountResult.data || 0 : 0,
        teams: teamCountResult.success ? teamCountResult.data || 0 : 0,
        timeRemaining,
        progress,
      },
      personal: personalRankings, // 전체 개인 랭킹 (Crux + Grip 합쳐서)
      crux: cruxRankings, // Crux 그룹 랭킹
      grip: gripRankings, // Grip 그룹 랭킹
      team: teamRankings,
      challenge: challengeRankings,
    });
  } catch (error) {
    console.error("랭킹 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
