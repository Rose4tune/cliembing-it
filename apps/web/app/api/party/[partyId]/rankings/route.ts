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

    // Supabase 클라이언트 생성
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
    const partyResult = await executeSupabaseQuery(async () => {
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
      const personalScoresResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("level_scores")
          .select("user_id, score")
          .eq("party_id", partyId)
          .eq("approved", true);
      });

      if (personalScoresResult.success && personalScoresResult.data) {
        const userIds = [...new Set(personalScoresResult.data.map((item: any) => item.user_id))];

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

          // party_members에서 팀 정보 가져오기
          const membersResult = await executeSupabaseQuery(async () => {
            return await supabase
              .from("party_members")
              .select("user_id, team_id")
              .eq("party_id", partyId)
              .in("user_id", userIds);
          });

          const teamMap = new Map();
          if (membersResult.success && membersResult.data) {
            const teamIds = membersResult.data
              .map((m: any) => m.team_id)
              .filter((id: string | null) => id !== null);

            if (teamIds.length > 0) {
              const teamsResult = await executeSupabaseQuery(async () => {
                return await supabase.from("teams").select("id, name").in("id", teamIds);
              });

              if (teamsResult.success && teamsResult.data) {
                teamsResult.data.forEach((team: any) => {
                  teamMap.set(team.id, team);
                });
              }
            }

            membersResult.data.forEach((member: any) => {
              if (member.team_id) {
                const team = teamMap.get(member.team_id);
                if (team) {
                  teamMap.set(member.user_id, team);
                }
              }
            });
          }

          const personalScores: Record<string, number> = {};
          personalScoresResult.data.forEach((item: any) => {
            const userId = item.user_id;
            personalScores[userId] = (personalScores[userId] || 0) + (item.score || 0);
          });

          personalRankings = Object.entries(personalScores)
            .map(([userId, totalScore]) => {
              const user = usersMap.get(userId) || {
                id: userId,
                nickname: "알 수 없음",
                email: null,
              };
              const team = teamMap.get(userId);
              return {
                userId: user.id,
                nickname: user.nickname,
                teamId: team?.id || null,
                teamName: team?.name || null,
                totalScore,
              };
            })
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
      personal: personalRankings,
      team: teamRankings,
      challenge: challengeRankings,
    });
  } catch (error) {
    console.error("랭킹 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
