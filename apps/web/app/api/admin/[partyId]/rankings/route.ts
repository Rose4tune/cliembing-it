import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * "5분 23초" 형식의 문자열을 밀리초로 변환
 */
function parseDurationToMs(duration: string | null): number {
  if (!duration) return Infinity;
  const minuteMatch = duration.match(/(\d+)분/);
  const secondMatch = duration.match(/(\d+)초/);
  const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
  const seconds = secondMatch ? parseInt(secondMatch[1], 10) : 0;
  return (minutes * 60 + seconds) * 1000;
}

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

      // 챌린지 랭킹 계산
      const allTeamIds = teamsResult.data.map((team: any) => team.id);

      // 챌린지 기록 조회
      const challengeRecordsResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("challenge_records")
          .select("team_id, attempt_number, duration, status, started_at")
          .eq("party_id", partyId)
          .in("team_id", allTeamIds)
          .neq("status", "invalidated");
      });

      // 팀별로 최고 기록 찾기
      const teamChallengeMap = new Map<string, any>();
      if (challengeRecordsResult.success && challengeRecordsResult.data) {
        challengeRecordsResult.data.forEach((record: any) => {
          if (record.status === "failed") return; // 실패 기록은 랭킹 계산에서 제외

          const teamId = record.team_id;
          if (!teamChallengeMap.has(teamId)) {
            teamChallengeMap.set(teamId, {
              bestTime: record.duration,
              bestStartedAt: record.started_at,
              attempts: 0,
              failures: 0,
            });
          }

          const teamData = teamChallengeMap.get(teamId);
          teamData.attempts += 1;
          if (record.status === "failed") {
            teamData.failures += 1;
          }

          // 더 빠른 시간 찾기
          const currentBest = parseDurationToMs(teamData.bestTime);
          const recordTime = parseDurationToMs(record.duration);
          if (recordTime < currentBest) {
            teamData.bestTime = record.duration;
            teamData.bestStartedAt = record.started_at;
          }
        });
      }

      // 모든 팀에 대해 챌린지 랭킹 생성
      challengeRankings = teamsResult.data.map((team: any) => {
        const teamData = teamChallengeMap.get(team.id);
        const attempts = teamData?.attempts || 0;
        const failures = teamData?.failures || 0;
        const bestTime = teamData?.bestTime || null;

        return {
          teamId: team.id,
          teamName: team.name,
          bestTime: bestTime,
          attempts: attempts,
          failures: failures,
          status: attempts === 2 && failures === 2 ? "all_failed" : "success",
        };
      });

      // 랭킹 정렬: 성공한 기록이 우선, 시간 순, 동일 시간이면 선착순
      challengeRankings.sort((a, b) => {
        // 성공 기록이 우선
        if (a.status === "all_failed" && b.status !== "all_failed") return 1;
        if (a.status !== "all_failed" && b.status === "all_failed") return -1;

        // 둘 다 실패면 동일 순위
        if (a.status === "all_failed" && b.status === "all_failed") return 0;

        // 둘 다 성공이면 시간 비교
        if (a.bestTime && b.bestTime) {
          const aTime = parseDurationToMs(a.bestTime);
          const bTime = parseDurationToMs(b.bestTime);
          if (aTime !== bTime) {
            return aTime - bTime; // 빠른 시간이 우선
          }
        }

        // 시간이 같거나 없으면 팀 번호 순
        const aNumber = parseInt(a.teamName.match(/(\d+)/)?.[1] || "0", 10);
        const bNumber = parseInt(b.teamName.match(/(\d+)/)?.[1] || "0", 10);
        return aNumber - bNumber;
      });

      // 랭킹 할당
      challengeRankings = challengeRankings.map((team, index) => ({
        ...team,
        rank: index + 1,
        time: team.bestTime || (team.status === "all_failed" ? "-분 -초" : "--:--"),
      }));
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
