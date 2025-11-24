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

    // rankings 테이블에서 랭킹 조회 (캐시된 랭킹)
    const rankingsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("rankings")
        .select("type, result, computed_at, updated_at")
        .eq("party_id", partyId);
    });

    // rankings 테이블에 데이터가 있으면 사용, 없으면 실시간 계산
    let personalRankings: any[] = [];
    let teamRankings: any[] = [];
    let challengeRankings: any[] = [];

    if (rankingsResult.success && rankingsResult.data) {
      rankingsResult.data.forEach((ranking: any) => {
        if (ranking.type === "personal") {
          personalRankings = ranking.result || [];
        } else if (ranking.type === "team") {
          teamRankings = ranking.result || [];
        } else if (ranking.type === "challenge") {
          challengeRankings = ranking.result || [];
        }
      });
    }

    // 개인 랭킹이 없으면 실시간 계산 (승인된 점수만)
    if (personalRankings.length === 0) {
      const personalRankingsResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("level_scores")
          .select("user_id, score")
          .eq("party_id", partyId)
          .eq("approved", true);
      });

      if (personalRankingsResult.success && personalRankingsResult.data) {
        const userIds = [...new Set(personalRankingsResult.data.map((item: any) => item.user_id))];

        if (userIds.length > 0) {
          const usersResult = await executeSupabaseQuery(async () => {
            return await supabase.from("users").select("id, nickname, email").in("id", userIds);
          });

          const usersMap = new Map();
          if (usersResult.success && usersResult.data) {
            usersResult.data.forEach((user: any) => {
              usersMap.set(user.id, user);
            });
          }

          const personalScores: Record<string, number> = {};
          personalRankingsResult.data.forEach((item: any) => {
            const userId = item.user_id;
            personalScores[userId] = (personalScores[userId] || 0) + (item.score || 0);
          });

          personalRankings = Object.entries(personalScores)
            .map(([userId, totalScore]) => ({
              user: usersMap.get(userId) || { id: userId, nickname: "알 수 없음", email: null },
              totalScore,
            }))
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((item, index) => ({
              ...item,
              rank: index + 1,
            }));
        }
      }
    }

    // 팀 랭킹이 없으면 실시간 계산
    if (teamRankings.length === 0) {
      const teamsResult = await executeSupabaseQuery(async () => {
        return await supabase.from("teams").select("id, name, score").eq("party_id", partyId);
      });

      if (teamsResult.success && teamsResult.data) {
        teamRankings = teamsResult.data
          .map((team: any) => ({
            teamId: team.id,
            teamName: team.name,
            totalScore: team.score || 0,
          }))
          .sort((a, b) => b.totalScore - a.totalScore)
          .map((item, index) => ({
            ...item,
            rank: index + 1,
          }));
      }
    }

    return successResponse({
      personal: personalRankings,
      team: teamRankings,
      challenge: challengeRankings,
    });
  } catch (error) {
    console.error("랭킹 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
