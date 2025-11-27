import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 전체 랭킹 조회 API (관리자용)
 * GET /api/admin/[partyId]/rankings
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

    // Supabase SQL 함수로 그룹별 랭킹 계산 (점수 높은 순으로 정렬)
    let cruxRankings: any[] = [];
    let gripRankings: any[] = [];
    let personalRankings: any[] = [];
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
    personalRankings = [...cruxRankings, ...gripRankings]
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({
        user: {
          id: item.userId,
          nickname: item.nickname,
        },
        totalScore: item.totalScore,
        rank: index + 1, // 전체 개인 랭킹 순위 재계산
      }));

    // 팀 랭킹 계산 (game_sessions에서 테트리스 게임 점수 합산)
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
                  (sum: number, session: { team_score: number }) => sum + (session.team_score || 0),
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

      // 챌린지 랭킹이 없으면 모든 팀을 기본 리스트로 생성
      if (challengeRankings.length === 0 && teamsResult.data.length > 0) {
        challengeRankings.push(
          ...teamsResult.data.map((team: { id: string; name: string }, index: number) => ({
            teamId: team.id,
            teamName: team.name,
            rank: index + 1,
            time: "--:--",
          })),
        );
      }
    }

    // Crux, Grip 랭킹을 관리자용 형식으로 변환
    const cruxRankingsFormatted = cruxRankings.map((item) => ({
      user: {
        id: item.userId,
        nickname: item.nickname,
      },
      totalScore: item.totalScore,
      rank: item.rank,
    }));

    const gripRankingsFormatted = gripRankings.map((item) => ({
      user: {
        id: item.userId,
        nickname: item.nickname,
      },
      totalScore: item.totalScore,
      rank: item.rank,
    }));

    return successResponse({
      crux: cruxRankingsFormatted,
      grip: gripRankingsFormatted,
      personal: personalRankings, // 하위 호환성을 위해 유지
      team: teamRankings,
      challenge: challengeRankings,
    });
  } catch (error) {
    console.error("랭킹 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
