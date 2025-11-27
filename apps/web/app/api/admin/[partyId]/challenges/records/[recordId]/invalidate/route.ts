import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 챌린지 기록 무효화 API (관리자용)
 * PATCH /api/admin/[partyId]/challenges/records/[recordId]/invalidate
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partyId: string; recordId: string }> },
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

    const { partyId, recordId } = await params;
    const supabase = createAdminClient();

    // 기록 조회
    const recordResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .select("id, party_id, team_id, attempt_number, status")
        .eq("id", recordId)
        .eq("party_id", partyId)
        .single();
    });

    if (!recordResult.success || !recordResult.data) {
      return errorResponse("챌린지 기록을 찾을 수 없습니다", 404);
    }

    const record = recordResult.data;

    // 이미 무효화된 경우
    if (record.status === "invalidated") {
      return errorResponse("이미 무효화된 기록입니다", 400);
    }

    // 무효화 처리
    const updateResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("challenge_records")
        .update({ status: "invalidated" })
        .eq("id", recordId)
        .eq("party_id", partyId)
        .select()
        .single();
    });

    if (!updateResult.success) {
      return errorResponse(
        updateResult.error?.message || "챌린지 기록을 무효화할 수 없습니다",
        500,
      );
    }

    return successResponse({
      id: updateResult.data.id,
      status: updateResult.data.status,
      message: "기록이 무효화되었습니다. 해당 팀은 다시 도전할 수 있습니다.",
    });
  } catch (error) {
    console.error("챌린지 기록 무효화 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
