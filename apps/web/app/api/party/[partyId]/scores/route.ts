import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import type { ClimbingLevel } from "@pkg/shared";
import { ENABLED_LEVELS, calculateLevelScore, type LevelPointsConfig } from "@pkg/shared";

/**
 * 점수 조회 API
 * GET /api/party/[partyId]/scores
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

    // Supabase 클라이언트 생성
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // party_members 조회 시 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // party_members 조회는 Service Role Key 사용 (RLS 우회)
        supabaseForQuery = createAdminClient();
        supabase = await createServerClient();
      }
    } catch (error) {
      console.error("Supabase 클라이언트 생성 에러:", error);
      try {
        supabaseForQuery = createAdminClient();
        supabase = await createServerClient();
      } catch (fallbackError) {
        console.error("Supabase 클라이언트 생성 실패:", fallbackError);
        return errorResponse("데이터베이스 연결에 실패했습니다", 500);
      }
    }

    if (!supabase || !supabaseForQuery) {
      return errorResponse("데이터베이스 연결에 실패했습니다", 500);
    }

    // 파티 멤버 확인 (Service Role Key 사용)
    const { data: member } = await supabaseForQuery
      .from("party_members")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      return errorResponse("파티에 참가하지 않았습니다", 403);
    }

    // 사용자의 점수 조회 (승인된 점수와 전체 점수 모두)
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("level_scores")
        .select("*")
        .eq("party_id", partyId)
        .eq("user_id", userId)
        .order("level", { ascending: true });
    });

    if (!result.success) {
      return errorResponse(result.error?.message || "점수 조회에 실패했습니다", 500);
    }

    return successResponse({
      scores: result.data || [],
    });
  } catch (error) {
    console.error("점수 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 점수 저장/업데이트 API
 * POST /api/party/[partyId]/scores
 */
export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
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
    const body = await request.json();
    const { level, problemCount } = body;

    // 유효성 검사
    if (!level || typeof problemCount !== "number" || problemCount < 0) {
      return errorResponse("유효하지 않은 입력입니다", 400);
    }

    if (!ENABLED_LEVELS.includes(level as ClimbingLevel)) {
      return errorResponse("해당 레벨은 현재 파티에서 사용할 수 없습니다", 400);
    }

    // Supabase 클라이언트 생성
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // party_members 조회 시 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // party_members 조회는 Service Role Key 사용 (RLS 우회)
        supabaseForQuery = createAdminClient();
        supabase = await createServerClient();
      }
    } catch (error) {
      console.error("Supabase 클라이언트 생성 에러:", error);
      try {
        supabaseForQuery = createAdminClient();
        supabase = await createServerClient();
      } catch (fallbackError) {
        console.error("Supabase 클라이언트 생성 실패:", fallbackError);
        return errorResponse("데이터베이스 연결에 실패했습니다", 500);
      }
    }

    if (!supabase || !supabaseForQuery) {
      return errorResponse("데이터베이스 연결에 실패했습니다", 500);
    }

    // 파티 멤버 확인 및 기준 레벨 가져오기 (Service Role Key 사용)
    const { data: member, error: memberError } = await supabaseForQuery
      .from("party_members")
      .select("id, level")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError || !member) {
      return errorResponse("파티에 참가하지 않았습니다", 403);
    }

    const userBaseLevel = member.level as ClimbingLevel | null;
    if (!userBaseLevel) {
      return errorResponse("사용자의 기준 레벨이 설정되지 않았습니다", 400);
    }

    // party_ruleset에서 점수 설정 가져오기
    const { data: ruleset } = await supabase
      .from("party_ruleset")
      .select("level_points")
      .eq("party_id", partyId)
      .single();

    const levelPointsConfig: LevelPointsConfig | null = ruleset?.level_points || null;

    // 점수 계산 (새 규칙 적용)
    const solvedLevel = level as ClimbingLevel;
    const score = calculateLevelScore(solvedLevel, problemCount, userBaseLevel, levelPointsConfig);

    // Unique 제약조건이 제거되었으므로, 같은 레벨에 대해 여러 레코드가 가능
    // 승인된 레코드는 보존하고, 새로운 승인 요청은 항상 새 레코드로 생성
    // (승인 대기 레코드도 업데이트하지 않고 새로 생성하여 각 승인 요청을 독립적으로 관리)

    // 항상 새 레코드로 생성 (승인된 레코드나 승인 대기 레코드와 관계없이)
    // Service Role Key 사용하여 RLS 정책 우회
    const result = await executeSupabaseQuery(async () => {
      return await supabaseForQuery
        .from("level_scores")
        .insert({
          party_id: partyId,
          user_id: userId,
          level,
          problem_count: problemCount,
          score,
          approved: null, // 승인 대기 상태
        })
        .select()
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "점수 저장에 실패했습니다", 500);
    }

    return successResponse({
      score: result.data,
      message: "점수가 저장되었습니다",
    });
  } catch (error) {
    console.error("점수 저장 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
