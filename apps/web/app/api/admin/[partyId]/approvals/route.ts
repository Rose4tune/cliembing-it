import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recalculateUserTotalScore,
  addBlockForScoreApproval,
  calculateAllRankings,
} from "@pkg/shared";
import type { ClimbingLevel } from "@pkg/shared";

/**
 * 랭킹 계산 및 rankings 테이블 업데이트
 * @deprecated 이 함수는 더 이상 사용하지 않음 (워커가 처리)
 */
async function _updateRankings(supabase: SupabaseClient, partyId: string) {
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

    // 개인 랭킹을 rankings 테이블에 저장 또는 업데이트
    const personalUpsertResult = await executeSupabaseQuery(async () => {
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

    if (!personalUpsertResult.success) {
      console.error("개인 랭킹 저장 실패:", personalUpsertResult.error);
    }

    // 팀 점수는 테트리스 게임 완료 시 업데이트됨 (여기서는 처리하지 않음)
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

    // 게임 요청 목록 조회 (game_sessions에서 status='pending'인 것만)
    const gameRequestsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("game_sessions")
        .select(
          `
          id,
          team_id,
          status,
          started_at,
          leader_confirmed_at,
          teams:team_id (
            id,
            name
          )
        `,
        )
        .eq("party_id", partyId)
        .eq("status", "pending")
        .order("id", { ascending: false }); // created_at이 없으므로 id로 정렬
    });

    console.log("🔍 게임 요청 조회 결과:", {
      success: gameRequestsResult.success,
      dataCount: gameRequestsResult.data?.length || 0,
      data: gameRequestsResult.data,
      error: gameRequestsResult.error,
    });

    const gameRequests =
      gameRequestsResult.success && gameRequestsResult.data
        ? gameRequestsResult.data.map((gs: any) => ({
            id: gs.id,
            team_id: gs.team_id,
            team_name: gs.teams?.name || "알 수 없음",
            status: gs.status,
            // pending 상태일 때는 started_at이 null이므로, id를 기반으로 시간을 추정하거나 null 허용
            requested_at: gs.started_at || gs.leader_confirmed_at || new Date().toISOString(), // null 방지
          }))
        : [];

    console.log("✅ 반환할 게임 요청:", gameRequests);

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
    const { scoreId, approved, gameSessionId, action } = body;

    // 게임 요청 승인/거부 처리
    if (action === "approve_game" || action === "reject_game") {
      if (!gameSessionId) {
        return errorResponse("게임 세션 ID가 필요합니다", 400);
      }

      const supabase = createAdminClient();

      // 게임 세션 상태 업데이트
      // approve_game: pending → ready (관리자 승인 완료, 참가자 게임 시작 대기)
      // reject_game: pending → cancelled (게임 요청 거부)
      const newStatus = action === "approve_game" ? "ready" : "cancelled";
      const adminUserId = session.user.id;

      const updateData: {
        status: string;
        started_by_admin_id?: string;
      } = {
        status: newStatus,
        // updated_at 컬럼이 없으므로 제거
      };

      if (action === "approve_game") {
        // ready 상태에서는 started_at을 설정하지 않음 (게임 시작 전이므로)
        // started_at은 참가자가 게임 시작 버튼을 눌렀을 때 설정됨
        updateData.started_by_admin_id = adminUserId; // 승인한 관리자 ID로 업데이트
      }

      const gameSessionResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("game_sessions")
          .update(updateData)
          .eq("id", gameSessionId)
          .eq("party_id", partyId)
          .eq("status", "pending") // pending 상태인 것만 업데이트
          .select()
          .single();
      });

      if (!gameSessionResult.success || !gameSessionResult.data) {
        return errorResponse(
          gameSessionResult.error?.message || "게임 요청 승인/거부에 실패했습니다",
          500,
        );
      }

      return successResponse({
        gameSessionId,
        status: newStatus,
        message:
          action === "approve_game" ? "게임 요청이 승인되었습니다" : "게임 요청이 거부되었습니다",
      });
    }

    // 점수 승인 처리 (기존 로직)
    if (!scoreId || approved === undefined) {
      return errorResponse("점수 ID와 승인 상태가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // level_scores 조회 (승인 전에 사용자 정보 확인용)
    const scoreResult = await executeSupabaseQuery<{
      id: string;
      user_id: string;
      level: string;
    }>(async () => {
      return await supabase
        .from("level_scores")
        .select("id, user_id, level")
        .eq("id", scoreId)
        .eq("party_id", partyId)
        .single();
    });

    if (!scoreResult.success || !scoreResult.data) {
      return errorResponse(scoreResult.error?.message || "점수 정보를 찾을 수 없습니다", 404);
    }

    const userId = scoreResult.data.user_id;
    const solvedLevel = scoreResult.data.level as ClimbingLevel;

    // 승인한 관리자 ID 가져오기
    const adminUserId = session.user.id;

    // level_scores의 approved, approved_by, approved_at 컬럼 업데이트
    const updateData: {
      approved: boolean | null;
      updated_at: string;
      approved_by?: string | null;
      approved_at?: string | null;
    } = {
      approved,
      updated_at: new Date().toISOString(),
    };

    if (approved === true) {
      // 승인 시: approved_by, approved_at 설정
      updateData.approved_by = adminUserId;
      updateData.approved_at = new Date().toISOString();
    } else if (approved === false) {
      // 거절 시: approved_by, approved_at null로 설정
      updateData.approved_by = null;
      updateData.approved_at = null;
    }
    // approved가 null인 경우 (승인 대기)는 기존 값 유지

    const result = await executeSupabaseQuery<{
      id: string;
      level: string;
      problem_count: number;
      approved: boolean | null;
    }>(async () => {
      return await supabase
        .from("level_scores")
        .update(updateData)
        .eq("id", scoreId)
        .eq("party_id", partyId)
        .select("id, level, problem_count, approved")
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "승인 상태 업데이트에 실패했습니다", 500);
    }

    // 승인된 경우에만 점수 재계산, 블럭 추가, 랭킹 계산
    if (approved === true) {
      // 업데이트된 레코드 확인
      const updatedScore = result.data;
      if (updatedScore.approved !== true) {
        console.error("승인 상태 업데이트 확인 실패:", updatedScore);
      }

      // 1. 사용자 총 점수 재계산 및 집계 테이블 업데이트
      // 방금 승인한 레코드 ID를 전달하여 트랜잭션 타이밍 문제 해결
      const recalcResult = await recalculateUserTotalScore(
        supabase,
        partyId,
        userId,
        scoreId, // 방금 승인한 레코드 ID 전달
      );
      if (!recalcResult.success) {
        console.error("점수 재계산 실패:", recalcResult.error);
        // 점수 재계산 실패는 로그만 남기고 계속 진행
      } else {
        console.log(
          `점수 재계산 완료: userId=${userId}, totalScore=${recalcResult.totalScore}, approvedCounts=${JSON.stringify(recalcResult.approvedProblemCounts)}`,
        );
      }

      // 2. 블럭 획득 처리 (problem_count만큼 블럭 추가)
      const problemCount = result.data.problem_count || 1;
      console.log("🔍 블럭 추가 호출 시작:", {
        partyId,
        userId,
        solvedLevel,
        scoreId,
        problemCount,
      });

      const blockResult = await addBlockForScoreApproval(
        supabase,
        partyId,
        userId,
        solvedLevel,
        scoreId,
        problemCount, // 문제 개수만큼 블럭 추가
      );

      console.log("🔍 블럭 추가 결과:", {
        success: blockResult.success,
        blockAdded: blockResult.blockAdded,
        error: blockResult.error,
      });

      if (!blockResult.success && blockResult.error) {
        console.error("❌ 블럭 추가 실패:", blockResult.error);
        // 블럭 추가 실패도 로그만 남기고 계속 진행
      }

      // 3. 랭킹 계산 (즉시 실행)
      // 점수 재계산 완료 후 랭킹 계산 (DB 반영을 위해 약간의 지연)
      // 실제로는 await로 순서가 보장되지만, DB 트랜잭션 반영을 위해 추가 대기
      await new Promise((resolve) => setTimeout(resolve, 100));

      const rankingResult = await calculateAllRankings(supabase, partyId);
      if (!rankingResult.success) {
        console.error("랭킹 계산 실패:", rankingResult.error);
        // 랭킹 계산 실패는 로그만 남기고 계속 진행
      } else {
        console.log(`랭킹 계산 완료: partyId=${partyId}`);
      }
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
