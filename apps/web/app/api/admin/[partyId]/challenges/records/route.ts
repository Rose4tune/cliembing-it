import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 챌린지 기록 저장 API (관리자용)
 * POST /api/admin/[partyId]/challenges/records
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
): Promise<Response> {
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
    const { teamId, attemptNumber, startedAt, endedAt, duration, status } = body;

    if (!teamId || !attemptNumber || !startedAt || !endedAt || !duration || !status) {
      return errorResponse("필수 필드가 누락되었습니다", 400);
    }

    if (attemptNumber !== 1 && attemptNumber !== 2) {
      return errorResponse("시도 횟수는 1 또는 2여야 합니다", 400);
    }

    if (status !== "success" && status !== "failed") {
      return errorResponse("상태는 success 또는 failed여야 합니다", 400);
    }

    const supabase = createAdminClient();

    // 파티 종료 여부 확인
    const partyResult = await executeSupabaseQuery(async () => {
      return await supabase.from("parties").select("status, end_at").eq("id", partyId).single();
    });

    if (!partyResult.success || !partyResult.data) {
      return errorResponse("파티를 찾을 수 없습니다", 404);
    }

    const party = partyResult.data as { status: string; end_at: string | null };
    if (party.status === "finished" || (party.end_at && new Date(party.end_at) < new Date())) {
      return errorResponse("파티가 종료되어 챌린지 기록을 시작할 수 없습니다", 400);
    }

    // 팀 확인
    const teamResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("teams")
        .select("id")
        .eq("id", teamId)
        .eq("party_id", partyId)
        .single();
    });

    if (!teamResult.success || !teamResult.data) {
      return errorResponse("팀을 찾을 수 없습니다", 404);
    }

    // 같은 팀의 같은 회차에 유효한 기록이 있는지 확인 (무효화된 기록 제외)
    const existingRecordResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .select("id, status")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .eq("attempt_number", attemptNumber)
        .neq("status", "invalidated")
        .maybeSingle();
    });

    if (existingRecordResult.success && existingRecordResult.data) {
      return errorResponse(
        `이미 ${attemptNumber}회차 기록이 존재합니다. 무효화 후 다시 시도해주세요.`,
        400,
      );
    }

    // 기록 저장
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .insert({
          party_id: partyId,
          team_id: teamId,
          attempt_number: attemptNumber,
          started_at: startedAt,
          ended_at: endedAt,
          duration: duration,
          status: status,
        })
        .select()
        .single();
    });

    if (!result.success) {
      return errorResponse(result.error?.message || "챌린지 기록을 저장할 수 없습니다", 500);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error("챌린지 기록 저장 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 챌린지 기록 조회 API (관리자용)
 * GET /api/admin/[partyId]/challenges/records
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ partyId: string }> },
): Promise<Response> {
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

    // 챌린지 기록 조회 (팀 정보 포함)
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .select(
          `
          id,
          team_id,
          attempt_number,
          started_at,
          ended_at,
          duration,
          status,
          created_at,
          updated_at,
          teams:team_id(id, name)
        `,
        )
        .eq("party_id", partyId)
        .order("created_at", { ascending: false });
    });

    if (!result.success) {
      return errorResponse(result.error?.message || "챌린지 기록을 불러올 수 없습니다", 500);
    }

    // 데이터 포맷팅
    const formattedData = (result.data || []).map((record: any) => ({
      id: record.id,
      teamId: record.team_id,
      teamName: record.teams?.name || "알 수 없음",
      attemptNumber: record.attempt_number,
      startedAt: record.started_at,
      endedAt: record.ended_at,
      duration: record.duration,
      status: record.status,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }));

    return successResponse(formattedData);
  } catch (error) {
    console.error("챌린지 기록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
