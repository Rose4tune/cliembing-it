/**
 * 랭킹 계산 서비스
 * 그룹별 랭킹 및 팀 랭킹 계산
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLevelGroup, type ClimbingLevel, type LevelGroup } from "../level";

async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
): Promise<{ success: boolean; data?: T; error?: any }> {
  try {
    const result = await queryFn();
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data as T };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 그룹별 랭킹 계산 및 저장
 */
export async function calculateGroupRankings(
  supabase: SupabaseClient,
  partyId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 모든 파티 멤버 조회 (그룹에 속한 모든 사람)
    const membersResult = await executeQuery(async () => {
      return await supabase
        .from("party_members")
        .select("user_id, level, team_id")
        .eq("party_id", partyId);
    });

    if (!membersResult.success || !membersResult.data) {
      await updateGroupRankings(supabase, partyId, "Crux", []);
      await updateGroupRankings(supabase, partyId, "Grip", []);
      return { success: true };
    }

    const userIds = membersResult.data.map((m: any) => m.user_id);

    // 2. 모든 사용자의 총 점수 조회 (user_total_scores, 0점 포함)
    const totalScoresResult = await executeQuery(async () => {
      return await supabase
        .from("user_total_scores")
        .select("user_id, total_score")
        .eq("party_id", partyId)
        .in("user_id", userIds.length > 0 ? userIds : [null]); // 빈 배열 방지
    });

    const totalScoresMap = new Map<string, number>();

    if (totalScoresResult.success && totalScoresResult.data) {
      totalScoresResult.data.forEach((item: any) => {
        totalScoresMap.set(item.user_id, item.total_score || 0);
      });
    }

    // user_total_scores에 레코드가 없는 사용자는 0점으로 설정
    userIds.forEach((userId) => {
      if (!totalScoresMap.has(userId)) {
        totalScoresMap.set(userId, 0);
      }
    });

    if (userIds.length === 0) {
      await updateGroupRankings(supabase, partyId, "Crux", []);
      await updateGroupRankings(supabase, partyId, "Grip", []);
      return { success: true };
    }

    // 3. 사용자 정보 조회 (모든 파티 멤버에 대해)
    const usersResult = await executeQuery(async () => {
      return await supabase
        .from("users")
        .select("id, nickname, email")
        .in("id", userIds);
    });

    const usersMap = new Map();
    if (usersResult.success && usersResult.data) {
      usersResult.data.forEach((user: any) => {
        usersMap.set(user.id, user);
      });
    }

    // 4. 팀 정보 조회
    const teamIds = membersResult.data
      .map((m: any) => m.team_id)
      .filter((id: string | null) => id !== null);

    const teamsMap = new Map();
    if (teamIds.length > 0) {
      const teamsResult = await executeQuery(async () => {
        return await supabase
          .from("teams")
          .select("id, name")
          .in("id", teamIds);
      });

      if (teamsResult.success && teamsResult.data) {
        teamsResult.data.forEach((team: any) => {
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

    membersResult.data.forEach((member: any) => {
      const userId = member.user_id;
      const userBaseLevel = member.level as ClimbingLevel | null;

      // user_total_scores에 레코드가 없어도 0점으로 처리
      const totalScore = totalScoresMap.has(userId)
        ? totalScoresMap.get(userId) || 0
        : 0;

      if (!userBaseLevel) {
        return;
      }

      const group = getLevelGroup(userBaseLevel);
      if (!group) {
        return; // 그룹이 없는 레벨 (Red, Orange, Yellow, Green, Black)은 제외
      }

      // user_total_scores에 레코드가 없으면 0점 레코드 생성 (옵션)
      // 하지만 여기서는 일단 랭킹에만 포함시키고, 나중에 자동 생성 가능

      const user = usersMap.get(userId);
      if (!user) {
        // 사용자 정보가 없으면 스킵 (데이터 불일치)
        return;
      }

      const team = member.team_id ? teamsMap.get(member.team_id) : null;

      const userRanking = {
        userId: user.id,
        nickname: user.nickname,
        teamId: team?.id || null,
        teamName: team?.name || null,
        totalScore, // 0점 포함 (user_total_scores에 레코드가 없어도)
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

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 그룹별 랭킹 저장
 */
async function updateGroupRankings(
  supabase: SupabaseClient,
  partyId: string,
  group: LevelGroup,
  rankings: any[],
): Promise<void> {
  const result = await executeQuery(async () => {
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
export async function calculateTeamRankings(
  supabase: SupabaseClient,
  partyId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 모든 팀 조회
    const teamsResult = await executeQuery(async () => {
      return await supabase
        .from("teams")
        .select("id, name")
        .eq("party_id", partyId);
    });

    if (!teamsResult.success || !teamsResult.data) {
      await updateTeamRankings(supabase, partyId, []);
      return { success: true };
    }

    // 2. 각 팀의 테트리스 게임 점수 합산
    const teamScoresPromises = teamsResult.data.map(
      async (team: { id: string; name: string }) => {
        const gameSessionsResult = await executeQuery(async () => {
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

    // 3. 랭킹 정렬
    const teamRankings = teamScores
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    // 4. rankings 테이블에 저장
    await updateTeamRankings(supabase, partyId, teamRankings);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 팀 랭킹 저장
 */
async function updateTeamRankings(
  supabase: SupabaseClient,
  partyId: string,
  rankings: any[],
): Promise<void> {
  const result = await executeQuery(async () => {
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

/**
 * 전체 랭킹 계산 (그룹별 + 팀)
 */
export async function calculateAllRankings(
  supabase: SupabaseClient,
  partyId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 그룹별 랭킹 계산
    const groupResult = await calculateGroupRankings(supabase, partyId);
    if (!groupResult.success) {
      return groupResult;
    }

    // 팀 랭킹 계산
    const teamResult = await calculateTeamRankings(supabase, partyId);
    if (!teamResult.success) {
      return teamResult;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
