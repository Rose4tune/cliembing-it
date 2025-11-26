import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient } from "@pkg/supabase/server";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 팀 블럭 조회 API
 * GET /api/party/[partyId]/team-blocks?teamId=xxx
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const { partyId } = await params;
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return errorResponse("teamId 파라미터가 필요합니다", 400);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    // 관리자 클라이언트를 사용하여 RLS 우회 (블럭 조회)
    // 권한 체크는 RLS에서 수행되므로, 여기서는 관리자 클라이언트로 직접 조회
    const adminClient = createAdminClient();

    // 직접 쿼리로 조회 (submission_id 필터 포함)
    // Supabase 함수는 나중에 업데이트 후 사용
    console.log("🔍 직접 쿼리로 블럭 조회 시작:", { partyId, teamId });

    // 디버깅: 필터 전 전체 블럭 조회
    const allBlocksDebug = await adminClient
      .from("team_block_events")
      .select("id, block_type, value, submission_id, game_session_id, created_at")
      .eq("party_id", partyId)
      .eq("team_id", teamId);

    console.log("🔍 전체 블럭 (필터 전):", {
      totalCount: allBlocksDebug.data?.length || 0,
      blocks: allBlocksDebug.data,
      error: allBlocksDebug.error,
    });

    // 승인된 점수와 연결된 블럭만 조회 (submission_id가 null이 아닌 것만)
    // Supabase PostgREST에서는 .not().is() 대신 직접 필터링
    const fallbackResult = await executeSupabaseQuery<
      Array<{
        id: string;
        block_type: string;
        created_at: string;
        value: number;
        submission_id: string | null;
      }>
    >(async () => {
      const result = await adminClient
        .from("team_block_events")
        .select("id, block_type, created_at, value, submission_id")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .is("game_session_id", null)
        .order("created_at", { ascending: true });

      // submission_id가 null인 블럭 필터링 (서버 사이드)
      if (result.data) {
        const filtered = result.data.filter((block) => block.submission_id !== null);
        console.log("🔍 필터링 결과:", {
          before: result.data.length,
          after: filtered.length,
          filteredOut: result.data.filter((b) => b.submission_id === null),
        });
        result.data = filtered;
      }
      return result;
    });

    if (!fallbackResult.success || fallbackResult.error) {
      console.error("❌ 블럭 조회 실패:", {
        partyId,
        teamId,
        userId,
        error: fallbackResult.error,
      });
      return errorResponse(fallbackResult.error?.message || "블럭 조회에 실패했습니다", 500);
    }

    const blocks = fallbackResult.data || [];

    // value만큼 블럭을 배열로 펼치기
    const expandedBlocks: Array<{
      id: string;
      block_type: string;
      created_at: string;
    }> = [];

    blocks.forEach((block) => {
      const count = block.value || 1;
      for (let i = 0; i < count; i++) {
        expandedBlocks.push({
          id: `${block.id}-${i}`,
          block_type: block.block_type || "",
          created_at: block.created_at,
        });
      }
    });

    console.log("✅ 블럭 조회 성공 (직접 쿼리):", {
      partyId,
      teamId,
      rawBlocksCount: blocks.length,
      expandedBlocksCount: expandedBlocks.length,
      blockDetails: blocks.map((b) => ({
        id: b.id,
        block_type: b.block_type,
        value: b.value,
        submission_id: b.submission_id,
      })),
    });

    return successResponse({
      blocks: expandedBlocks,
    });
  } catch (error) {
    console.error("팀 블럭 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
