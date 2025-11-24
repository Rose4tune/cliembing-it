import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 랭킹 계산 및 rankings 테이블 업데이트
 */
async function updateRankings(supabase: SupabaseClient, partyId: string) {
  try {
    // 개인 랭킹 계산 (승인된 점수만)
    const personalScoresResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select("user_id, score")
        .eq("party_id", partyId)
        .eq("approved", true);
    });

    let personalRankings: any[] = [];

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

    // rankings 테이블에 저장 또는 업데이트
    const upsertResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("rankings")
        .upsert(
          {
            party_id: partyId,
            type: "personal",
            result: personalRankings,
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

    if (!upsertResult.success) {
      console.error("랭킹 저장 실패:", upsertResult.error);
    }
  } catch (error) {
    console.error("랭킹 업데이트 에러:", error);
  }
}

/**
 * 승인 대기 목록 조회 API (관리자용)
 * GET /api/admin/[partyId]/approvals
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

    // 점수 승인 대기 목록 조회 (approved가 NULL인 것만)
    const scoresResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select(
          `
          id,
          user_id,
          level,
          problem_count,
          score,
          created_at,
          updated_at,
          approved,
          users:user_id (
            id,
            nickname,
            email
          )
        `,
        )
        .eq("party_id", partyId)
        .is("approved", null)
        .order("created_at", { ascending: false });
    });

    // 승인 완료된 점수 목록 조회 (approved가 TRUE인 것만)
    const approvedScoresResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select(
          `
          id,
          user_id,
          level,
          problem_count,
          score,
          created_at,
          updated_at,
          approved,
          users:user_id (
            id,
            nickname,
            email
          )
        `,
        )
        .eq("party_id", partyId)
        .eq("approved", true)
        .order("updated_at", { ascending: false });
    });

    // 게임 요청 목록 조회
    // TODO: game_requests 테이블이 생성되면 해당 테이블 조회
    const gameRequests: any[] = [];

    return successResponse({
      scores: scoresResult.success ? scoresResult.data || [] : [],
      approvedScores: approvedScoresResult.success ? approvedScoresResult.data || [] : [],
      gameRequests: gameRequests,
    });
  } catch (error) {
    console.error("승인 대기 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 점수 승인 API (관리자용)
 * POST /api/admin/[partyId]/approvals
 */
export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
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
    const body = await request.json();
    const { scoreId, approved } = body;

    if (!scoreId || approved === undefined) {
      return errorResponse("점수 ID와 승인 상태가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // level_scores의 approved 컬럼 업데이트
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .update({ approved })
        .eq("id", scoreId)
        .eq("party_id", partyId)
        .select()
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "승인 상태 업데이트에 실패했습니다", 500);
    }

    // 승인된 경우에만 랭킹 업데이트
    if (approved === true) {
      await updateRankings(supabase, partyId);
    }

    return successResponse({
      scoreId,
      approved,
      message: "승인 상태가 업데이트되었습니다",
    });
  } catch (error) {
    console.error("점수 승인 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
