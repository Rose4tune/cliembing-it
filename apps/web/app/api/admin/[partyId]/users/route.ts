import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 멤버 목록 조회 API (관리자용)
 * GET /api/admin/[partyId]/users
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

    // 파티 멤버 목록 조회
    const membersResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .select(
          "id, user_id, level, team_id, role, base_level_override, checkin_status, checked_in_at, joined_at",
        )
        .eq("party_id", partyId)
        .order("team_id", { ascending: true, nullsFirst: true })
        .order("joined_at", { ascending: true });
    });

    if (!membersResult.success) {
      console.error("멤버 목록 조회 실패:", membersResult.error);
      return errorResponse(membersResult.error?.message || "멤버 목록을 불러올 수 없습니다", 500);
    }

    if (!membersResult.data) {
      return successResponse([]);
    }

    // 유저 ID 목록 추출
    const userIds = membersResult.data.map((member: any) => member.user_id);

    if (userIds.length === 0) {
      return successResponse([]);
    }

    // 유저 정보 조회
    const usersResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("users")
        .select("id, nickname, email, base_level, mbti")
        .in("id", userIds);
    });

    if (!usersResult.success) {
      console.error("유저 정보 조회 실패:", usersResult.error);
      // 유저 정보 조회 실패해도 멤버 정보는 반환
    }

    // 팀 ID 목록 추출
    const teamIds = membersResult.data
      .map((member: any) => member.team_id)
      .filter((id: string | null) => id !== null);

    // 팀 정보 조회
    const teamsMap = new Map();
    if (teamIds.length > 0) {
      const teamsResult = await executeSupabaseQuery(async () => {
        return await supabase.from("teams").select("id, name, color").in("id", teamIds);
      });

      if (teamsResult.success && teamsResult.data) {
        teamsResult.data.forEach((team: any) => {
          teamsMap.set(team.id, team);
        });
      }
    }

    // 멤버와 유저 정보 결합
    const usersMap = new Map();
    if (usersResult.success && usersResult.data) {
      usersResult.data.forEach((user: any) => {
        usersMap.set(user.id, user);
      });
    }

    const blockSetResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_member_block_sets")
        .select("user_id, set_number")
        .eq("party_id", partyId);
    });

    const blockSetMap = new Map<string, number>();
    if (blockSetResult.success && blockSetResult.data) {
      blockSetResult.data.forEach((item: any) => {
        blockSetMap.set(item.user_id, item.set_number);
      });
    }

    const membersWithUsers = membersResult.data.map((member: any) => ({
      ...member,
      users: usersMap.get(member.user_id) || {
        id: member.user_id,
        nickname: "알 수 없음",
        email: null,
        base_level: null,
        mbti: null,
      },
      team: member.team_id
        ? (() => {
            const team = teamsMap.get(member.team_id);
            return team
              ? {
                  id: team.id,
                  name: team.name,
                  color: team.color,
                }
              : null;
          })()
        : null,
      block_set_number: blockSetMap.get(member.user_id) ?? null,
    }));

    return successResponse(membersWithUsers);
  } catch (error) {
    console.error("멤버 목록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 파티 멤버 정보 업데이트 API (관리자용)
 * PATCH /api/admin/[partyId]/users
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
) {
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
    const { memberId, level, teamId, role, blockSetNumber } = body;

    if (!memberId) {
      return errorResponse("멤버 ID가 필요합니다", 400);
    }

    const supabase = createAdminClient();

    // 기존 party_members 레코드 조회 (기존 team_id 확인용)
    const existingMemberResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .select("user_id, team_id")
        .eq("id", memberId)
        .eq("party_id", partyId)
        .single();
    });

    if (!existingMemberResult.success || !existingMemberResult.data) {
      return errorResponse("멤버를 찾을 수 없습니다", 404);
    }

    const existingMember = existingMemberResult.data as {
      team_id: string | null;
      user_id: string;
    };
    const existingTeamId = existingMember.team_id;
    const userId = existingMember.user_id;

    // 업데이트할 데이터 준비
    const updateData: {
      level?: string | null;
      team_id?: string | null;
      role?: string;
    } = {};

    if (level !== undefined) {
      updateData.level = level || null;
    }
    if (teamId !== undefined) {
      updateData.team_id = teamId || null;
    }
    if (role !== undefined) {
      updateData.role = role;
    }

    // party_members 업데이트
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .update(updateData)
        .eq("id", memberId)
        .eq("party_id", partyId)
        .select()
        .single();
    });

    if (!result.success) {
      return errorResponse("멤버 정보를 업데이트할 수 없습니다", 500);
    }

    // 레벨이 지정된 경우 user_total_scores에 0점 레코드 생성 (그룹에 속한 경우만) 및 랭킹 재계산
    if (level !== undefined && level) {
      const { getLevelGroup, calculateAllRankings } = await import("@pkg/shared");
      const userLevelGroup = getLevelGroup(level as any);

      if (userLevelGroup) {
        // 그룹에 속한 레벨이면 user_total_scores에 0점 레코드 생성
        await executeSupabaseQuery(async () => {
          return await supabase.from("user_total_scores").upsert(
            {
              party_id: partyId,
              user_id: userId,
              total_score: 0,
              approved_problem_counts: {},
              last_calculated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "party_id,user_id",
            },
          );
        });

        // 랭킹 재계산 (비동기, 응답을 기다리지 않음)
        import("@pkg/shared")
          .then(({ calculateAllRankings }) => {
            return calculateAllRankings(supabase, partyId);
          })
          .catch((error) => {
            console.error("랭킹 재계산 실패:", error);
          });
      }
    }

    // team_id가 변경된 경우 team_members 테이블 동기화 및 승인된 점수 취소
    if (teamId !== undefined && existingTeamId !== teamId) {
      // 팀 배정이 변경되면 이전까지의 승인된 점수를 전부 취소 (approved = NULL로 변경)
      const cancelApprovedScoresResult = await executeSupabaseQuery(async () => {
        return await supabase
          .from("level_scores")
          .update({ approved: null })
          .eq("party_id", partyId)
          .eq("user_id", userId)
          .eq("approved", true);
      });

      if (!cancelApprovedScoresResult.success) {
        console.error("승인된 점수 취소 실패:", cancelApprovedScoresResult.error);
        // 실패해도 계속 진행
      }

      // 기존 team_members 레코드 삭제 (기존 team_id가 있는 경우)
      if (existingTeamId) {
        const deleteResult = await executeSupabaseQuery(async () => {
          return await supabase
            .from("team_members")
            .delete()
            .eq("team_id", existingTeamId)
            .eq("user_id", userId);
        });

        if (!deleteResult.success) {
          console.error("기존 team_members 삭제 실패:", deleteResult.error);
          // 삭제 실패해도 계속 진행 (이미 없을 수도 있음)
        }
      }

      // 새로운 team_id가 있으면 team_members 레코드 생성
      if (teamId) {
        const insertResult = await executeSupabaseQuery(async () => {
          // 기존 레코드가 있는지 확인
          const { data: existing } = await supabase
            .from("team_members")
            .select("id")
            .eq("team_id", teamId)
            .eq("user_id", userId)
            .single();

          if (existing) {
            // 이미 존재하면 업데이트하지 않음
            return { data: existing, error: null };
          }

          // 없으면 생성
          return await supabase
            .from("team_members")
            .insert({
              team_id: teamId,
              user_id: userId,
            })
            .select()
            .single();
        });

        if (!insertResult.success) {
          console.error("team_members 생성 실패:", insertResult.error);
          // 생성 실패해도 party_members는 이미 업데이트되었으므로 계속 진행
        }
      }
    }

    const targetTeamId = teamId !== undefined ? teamId : existingTeamId;

    if (blockSetNumber !== undefined) {
      if (!targetTeamId && blockSetNumber !== null) {
        return errorResponse("팀이 배정된 경우에만 블럭 Set을 설정할 수 있습니다", 400);
      }

      if (blockSetNumber === null) {
        await executeSupabaseQuery(async () => {
          return await supabase
            .from("party_member_block_sets")
            .delete()
            .eq("party_id", partyId)
            .eq("user_id", userId);
        });
      } else {
        if (blockSetNumber < 1 || blockSetNumber > 5) {
          return errorResponse("블럭 Set 번호는 1~5 사이여야 합니다", 400);
        }

        let conflictExists = false;
        if (targetTeamId) {
          const teammatesResult = await executeSupabaseQuery(async () => {
            return await supabase
              .from("party_members")
              .select("user_id")
              .eq("party_id", partyId)
              .eq("team_id", targetTeamId)
              .neq("user_id", userId);
          });

          if (teammatesResult.success && teammatesResult.data && teammatesResult.data.length > 0) {
            const teammateIds = teammatesResult.data.map((m: any) => m.user_id);
            const conflictResult = await executeSupabaseQuery(async () => {
              return await supabase
                .from("party_member_block_sets")
                .select("user_id")
                .eq("party_id", partyId)
                .eq("set_number", blockSetNumber)
                .in("user_id", teammateIds);
            });

            if (conflictResult.success && conflictResult.data && conflictResult.data.length > 0) {
              conflictExists = true;
            }
          }
        }

        if (conflictExists) {
          return errorResponse("이미 다른 팀원이 사용중인 블럭 Set 입니다", 400);
        }

        await executeSupabaseQuery(async () => {
          return await supabase.from("party_member_block_sets").upsert(
            {
              party_id: partyId,
              user_id: userId,
              set_number: blockSetNumber,
            },
            { onConflict: "party_id,user_id" },
          );
        });
      }
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("멤버 정보 업데이트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
