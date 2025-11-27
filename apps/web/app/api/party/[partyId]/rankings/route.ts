import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
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

type TeamMember = {
  name: string;
  level: string;
};

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
    let challengeRankings: any[] = [];

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

    // 모든 팀 조회 (게임 세션이 없어도 포함)
    const allTeamsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("teams")
        .select("id, name")
        .eq("party_id", partyId)
        .order("name", { ascending: true });
    });

    // 팀 랭킹 조회 (get_team_rankings_with_details 함수 사용)
    const teamRankingsResult = await executeSupabaseQuery(async () => {
      return await supabase.rpc("get_team_rankings_with_details", {
        p_party_id: partyId,
      });
    });

    // 모든 팀을 포함하되, 랭킹 데이터가 있으면 사용
    const teamRankingsMap = new Map<string, any>();
    if (teamRankingsResult.success && teamRankingsResult.data) {
      teamRankingsResult.data.forEach((item: any) => {
        const teamNumberMatch = item.team_name?.match(/(\d+)/);
        const teamNumber = teamNumberMatch ? parseInt(teamNumberMatch[1], 10) : 0;

        teamRankingsMap.set(item.team_id, {
          rank: item.rank,
          teamNumber,
          teamId: item.team_id,
          teamName: item.team_name,
          totalScore: Number(item.total_score) || 0,
          usedPieces: Number(item.used_pieces) || 0,
          totalPieces: Number(item.total_pieces) || 0,
          completedLines: Number(item.completed_lines) || 0,
        });
      });
    }

    // 모든 팀을 포함 (랭킹 데이터가 없으면 0점으로 설정)
    if (allTeamsResult.success && allTeamsResult.data) {
      const existingRankingsCount = teamRankingsMap.size;
      allTeamsResult.data.forEach((team: any, index: number) => {
        if (!teamRankingsMap.has(team.id)) {
          const teamNumberMatch = team.name?.match(/(\d+)/);
          const teamNumber = teamNumberMatch ? parseInt(teamNumberMatch[1], 10) : index + 1;

          teamRankingsMap.set(team.id, {
            rank: existingRankingsCount + index + 1,
            teamNumber,
            teamId: team.id,
            teamName: team.name,
            totalScore: 0,
            usedPieces: 0,
            totalPieces: 0,
            completedLines: 0,
          });
        }
      });
    }

    teamRankings = Array.from(teamRankingsMap.values()).sort((a, b) => {
      // 점수 순으로 정렬, 같으면 팀 번호 순
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.teamNumber - b.teamNumber;
    });

    // 랭킹 재계산
    teamRankings = teamRankings.map((team, index) => ({
      ...team,
      rank: index + 1,
    }));

    // 모든 팀의 멤버 정보 조회
    const allTeamIds = Array.from(teamRankingsMap.keys());
    if (allTeamIds.length > 0) {
      const teamMembersResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("party_members")
          .select(
            `
            team_id,
            level,
            users:user_id(id, nickname)
          `,
          )
          .eq("party_id", partyId)
          .in("team_id", allTeamIds);
      });

      if (teamMembersResult.success && teamMembersResult.data) {
        const membersMap = new Map<string, Array<{ name: string; level: string }>>();
        teamMembersResult.data.forEach((member: any) => {
          if (!member.team_id) return;
          if (!membersMap.has(member.team_id)) {
            membersMap.set(member.team_id, []);
          }
          membersMap.get(member.team_id)?.push({
            name: member.users?.nickname || "알 수 없음",
            level: member.level || "White",
          });
        });

        teamRankings = teamRankings.map((team) => ({
          ...team,
          members: team.teamId ? membersMap.get(team.teamId) || [] : [],
        }));
      }
    }

    // 챌린지 랭킹 계산
    if (allTeamsResult.success && allTeamsResult.data) {
      const allTeamIds = allTeamsResult.data.map((team: any) => team.id);

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
          const teamId = record.team_id;
          if (!teamChallengeMap.has(teamId)) {
            teamChallengeMap.set(teamId, {
              bestTime: null,
              bestStartedAt: null,
              attempts: 0,
              failures: 0,
            });
          }

          const teamData = teamChallengeMap.get(teamId);
          // 실패 기록도 attempts에 포함
          teamData.attempts += 1;
          if (record.status === "failed") {
            teamData.failures += 1;
          } else {
            // 성공 기록만 최고 시간 계산에 포함
            const currentBest = parseDurationToMs(teamData.bestTime);
            const recordTime = parseDurationToMs(record.duration);
            if (teamData.bestTime === null || recordTime < currentBest) {
              teamData.bestTime = record.duration;
              teamData.bestStartedAt = record.started_at;
            }
          }
        });
      }

      // 모든 팀에 대해 챌린지 랭킹 생성
      challengeRankings = allTeamsResult.data.map((team: any) => {
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
      }));
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
      partyStartAt: party.start_at,
      partyEndAt: party.end_at,
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
