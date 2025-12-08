import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dequeueRankingCalculation,
  completeRankingCalculation,
  failRankingCalculation,
} from "@pkg/shared";
import { getLevelGroup, type ClimbingLevel, type LevelGroup } from "@pkg/shared";

// 타입 정의
interface PartyMember {
  user_id: string;
  level: string | null;
  team_id: string | null;
}

interface TotalScore {
  user_id: string;
  total_score: number | null;
}

interface User {
  id: string;
  nickname: string;
  email: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface UserRanking {
  userId: string;
  nickname: string;
  teamId: string | null;
  teamName: string | null;
  totalScore: number;
}

interface RankingResult {
  userId: string;
  nickname: string;
  teamId: string | null;
  teamName: string | null;
  totalScore: number;
  rank: number;
}

/**
 * 랭킹 계산 (워커용)
 * 큐에서 작업을 가져와서 랭킹을 계산하고 rankings 테이블 업데이트
 * POST /api/admin/[partyId]/rankings/calculate
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partyId?: string }> },
): Promise<Response> {
  const supabase = createAdminClient();

  try {
    const { partyId: paramPartyId } = await params;

    // 큐에서 다음 작업 가져오기
    const dequeueResult = await dequeueRankingCalculation(supabase);

    if (!dequeueResult.success || !dequeueResult.item) {
      return successResponse({
        processed: false,
        message: "처리할 작업이 없습니다",
      });
    }

    const queueId = dequeueResult.item.id;
    const partyId = paramPartyId || dequeueResult.item.party_id;

    try {
      // 그룹별 랭킹 계산 (개인 랭킹)
      await calculateGroupRankings(supabase, partyId);

      // 팀 랭킹 계산 (테트리스 게임 점수)
      await calculateTeamRankings(supabase, partyId);

      // 큐 항목 완료 처리
      await completeRankingCalculation(supabase, queueId);

      return successResponse({
        processed: true,
        partyId,
        queueId,
        message: "랭킹 계산이 완료되었습니다",
      });
    } catch (error) {
      // 실패 처리
      await failRankingCalculation(
        supabase,
        queueId,
        error instanceof Error ? error.message : "알 수 없는 오류",
      );

      return errorResponse(
        error instanceof Error ? error.message : "랭킹 계산 중 오류가 발생했습니다",
        500,
      );
    }
  } catch (error) {
    console.error("랭킹 계산 워커 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 그룹별 랭킹 계산 및 저장
 */
async function calculateGroupRankings(supabase: SupabaseClient, partyId: string) {
  // 1. 모든 파티 멤버 조회 (그룹에 속한 모든 사람)
  const membersResult = await executeSupabaseQuery(async () => {
    return await supabase
      .from("party_members")
      .select("user_id, level, team_id")
      .eq("party_id", partyId);
  });

  if (!membersResult.success || !membersResult.data) {
    await updateGroupRankings(supabase, partyId, "Crux", []);
    await updateGroupRankings(supabase, partyId, "Grip", []);
    return;
  }

  // 2. 모든 사용자의 총 점수 조회 (user_total_scores, 0점 포함)
  const totalScoresResult = await executeSupabaseQuery(async () => {
    return await supabase
      .from("user_total_scores")
      .select("user_id, total_score")
      .eq("party_id", partyId);
  });

  const userIds = (membersResult.data as PartyMember[]).map((m) => m.user_id);
  const totalScoresMap = new Map<string, number>();

  if (totalScoresResult.success && totalScoresResult.data) {
    (totalScoresResult.data as TotalScore[]).forEach((item) => {
      totalScoresMap.set(item.user_id, item.total_score || 0);
    });
  }

  if (userIds.length === 0) {
    await updateGroupRankings(supabase, partyId, "Crux", []);
    await updateGroupRankings(supabase, partyId, "Grip", []);
    return;
  }

  // 3. 사용자 정보 조회
  const usersResult = await executeSupabaseQuery(async () => {
    return await supabase.from("users").select("id, nickname, email").in("id", userIds);
  });

  const usersMap = new Map<string, User>();
  if (usersResult.success && usersResult.data) {
    (usersResult.data as User[]).forEach((user) => {
      usersMap.set(user.id, user);
    });
  }

  // 4. 팀 정보 조회
  const teamIds = (membersResult.data as PartyMember[])
    .map((m) => m.team_id)
    .filter((id): id is string => id !== null);

  const teamsMap = new Map();
  if (teamIds.length > 0) {
    const teamsResult = await executeSupabaseQuery(async () => {
      return await supabase.from("teams").select("id, name").in("id", teamIds);
    });

    if (teamsResult.success && teamsResult.data) {
      (teamsResult.data as Team[]).forEach((team) => {
        teamsMap.set(team.id, team);
      });
    }
  }

  // 5. 그룹별로 분류 (0점 포함)
  const cruxUsers: Array<{
    userId: string;
    nickname: string;
    teamId: string | null;
    teamName: string | null;
    totalScore: number;
  }> = [];

  const gripUsers: Array<{
    userId: string;
    nickname: string;
    teamId: string | null;
    teamName: string | null;
    totalScore: number;
  }> = [];

  (membersResult.data as PartyMember[]).forEach((member) => {
    const userId = member.user_id;
    const userBaseLevel = member.level as ClimbingLevel | null;
    const totalScore = totalScoresMap.get(userId) || 0;

    if (!userBaseLevel) {
      return;
    }

    const group = getLevelGroup(userBaseLevel);
    if (!group) {
      return; // 그룹이 없는 레벨 (Red, Orange, Yellow, Green, Black)은 제외
    }

    const user = usersMap.get(userId) || {
      id: userId,
      nickname: "알 수 없음",
      email: null,
    };

    const team = member.team_id ? teamsMap.get(member.team_id) : null;

    const userRanking = {
      userId: user.id,
      nickname: user.nickname,
      teamId: team?.id || null,
      teamName: team?.name || null,
      totalScore, // 0점 포함
    };

    if (group === "Crux") {
      cruxUsers.push(userRanking);
    } else if (group === "Grip") {
      gripUsers.push(userRanking);
    }
  });

  // 6. 그룹별 랭킹 정렬 및 저장
  cruxUsers.sort((a, b) => b.totalScore - a.totalScore);
  gripUsers.sort((a, b) => b.totalScore - a.totalScore);

  const cruxRankings = cruxUsers.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  const gripRankings = gripUsers.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  // 7. rankings 테이블 업데이트
  await updateGroupRankings(supabase, partyId, "Crux", cruxRankings);
  await updateGroupRankings(supabase, partyId, "Grip", gripRankings);
}

/**
 * 그룹별 랭킹 저장
 */
async function updateGroupRankings(
  supabase: SupabaseClient,
  partyId: string,
  group: LevelGroup,
  rankings: RankingResult[],
) {
  const result = await executeSupabaseQuery(async () => {
    return await supabase
      .from("rankings")
      .upsert(
        {
          party_id: partyId,
          type: group.toLowerCase(), // "crux" or "grip"
          result: rankings,
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "party_id,type",
        },
      )
      .select()
      .single();
  });

  if (!result.success) {
    console.error(`${group} 그룹 랭킹 저장 실패:`, result.error);
  }
}

/**
 * 팀 랭킹 계산 및 저장 (테트리스 게임 점수 기반)
 */
async function calculateTeamRankings(supabase: SupabaseClient, partyId: string) {
  // 1. 모든 팀 조회
  const teamsResult = await executeSupabaseQuery(async () => {
    return await supabase.from("teams").select("id, name").eq("party_id", partyId);
  });

  if (!teamsResult.success || !teamsResult.data) {
    await updateTeamRankings(supabase, partyId, []);
    return;
  }

  // 2. 각 팀의 테트리스 게임 점수 합산
  const teamScoresPromises = teamsResult.data.map(async (team: { id: string; name: string }) => {
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
  });

  const teamScores = await Promise.all(teamScoresPromises);

  // 3. 랭킹 정렬
  const teamRankings = teamScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  // 4. rankings 테이블에 저장
  await updateTeamRankings(supabase, partyId, teamRankings);
}

/**
 * 팀 랭킹 저장
 */
async function updateTeamRankings(
  supabase: SupabaseClient,
  partyId: string,
  rankings: Array<{
    teamId: string;
    teamName: string;
    totalScore: number;
    rank: number;
  }>,
) {
  const result = await executeSupabaseQuery(async () => {
    return await supabase
      .from("rankings")
      .upsert(
        {
          party_id: partyId,
          type: "team",
          result: rankings,
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "party_id,type",
        },
      )
      .select()
      .single();
  });

  if (!result.success) {
    console.error("팀 랭킹 저장 실패:", result.error);
  }
}
