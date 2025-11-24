import { NextResponse } from "next/server";
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

    // 개인 랭킹 조회 (전체 점수 합계)
    const personalRankingsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select(
          `
          user_id,
          score,
          users:user_id (
            id,
            nickname,
            email
          )
        `,
        )
        .eq("party_id", partyId);
    });

    // 개인별 총점 계산
    const personalScores: Record<string, { user: any; totalScore: number }> = {};
    if (personalRankingsResult.success && personalRankingsResult.data) {
      personalRankingsResult.data.forEach((item: any) => {
        const userId = item.user_id;
        if (!personalScores[userId]) {
          personalScores[userId] = {
            user: item.users,
            totalScore: 0,
          };
        }
        personalScores[userId].totalScore += item.score || 0;
      });
    }

    const personalRankings = Object.values(personalScores)
      .map((item) => ({
        user: item.user,
        totalScore: item.totalScore,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    // 팀 랭킹 조회
    const teamRankingsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .select(
          `
          team_number,
          user_id,
          level_scores:user_id (
            score
          )
        `,
        )
        .eq("party_id", partyId)
        .not("team_number", "is", null);
    });

    // 팀별 총점 계산
    const teamScores: Record<number, number> = {};
    if (teamRankingsResult.success && teamRankingsResult.data) {
      teamRankingsResult.data.forEach((item: any) => {
        const teamNumber = item.team_number;
        if (!teamScores[teamNumber]) {
          teamScores[teamNumber] = 0;
        }
        if (item.level_scores && Array.isArray(item.level_scores)) {
          item.level_scores.forEach((score: any) => {
            teamScores[teamNumber] += score.score || 0;
          });
        }
      });
    }

    const teamRankings = Object.entries(teamScores)
      .map(([teamNumber, totalScore]) => ({
        teamNumber: parseInt(teamNumber),
        totalScore,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    // 챌린지 랭킹 (임시로 빈 배열)
    const challengeRankings: any[] = [];

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
