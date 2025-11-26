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

    // Supabase 함수를 먼저 시도 (SECURITY DEFINER로 RLS 우회)
    const blocksResult = await executeSupabaseQuery<
      Array<{
        id: string;
        block_type: string;
        created_at: string;
        original_id: string;
        block_index: number;
      }>
    >(async () => {
      return await adminClient.rpc("get_team_blocks", {
        p_party_id: partyId,
        p_team_id: teamId,
      });
    });

    if (blocksResult.success && blocksResult.data && blocksResult.data.length > 0) {
      // 함수 성공 시
      const formattedBlocks = blocksResult.data.map((block) => ({
        id: block.id,
        block_type: block.block_type || "",
        created_at: block.created_at,
      }));

      console.log("✅ 블럭 조회 성공 (Supabase 함수 사용):", {
        partyId,
        teamId,
        blocksCount: formattedBlocks.length,
      });

      return successResponse({
        blocks: formattedBlocks,
      });
    }

    // 함수 실패 시 직접 쿼리로 폴백 (관리자 클라이언트 사용)
    console.log("⚠️ Supabase 함수 실패, 직접 쿼리로 폴백:", blocksResult.error);

    const fallbackResult = await executeSupabaseQuery<
      Array<{
        id: string;
        block_type: string;
        created_at: string;
        value: number;
      }>
    >(async () => {
      return await adminClient
        .from("team_block_events")
        .select("id, block_type, created_at, value")
        .eq("party_id", partyId)
        .eq("team_id", teamId)
        .is("game_session_id", null)
        .order("created_at", { ascending: true });
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
    });

    return successResponse({
      blocks: expandedBlocks,
    });
  } catch (error) {
    console.error("팀 블럭 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
