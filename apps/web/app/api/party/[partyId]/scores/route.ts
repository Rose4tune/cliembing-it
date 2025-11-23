import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import type { ClimbingLevel } from "@pkg/shared";
import { calculateScore, ENABLED_LEVELS } from "@pkg/shared";

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
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
      } else {
        supabase = await createServerClient();
      }
    } catch (error) {
      supabase = await createServerClient();
    }

    // 파티 멤버 확인
    const { data: member } = await supabase
      .from("party_members")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .single();

    if (!member) {
      return errorResponse("파티에 참가하지 않았습니다", 403);
    }

    // 사용자의 점수 조회
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
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
      } else {
        supabase = await createServerClient();
      }
    } catch (error) {
      supabase = await createServerClient();
    }

    // 파티 멤버 확인
    const { data: member } = await supabase
      .from("party_members")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .single();

    if (!member) {
      return errorResponse("파티에 참가하지 않았습니다", 403);
    }

    // 점수 계산
    const score = calculateScore(level as ClimbingLevel, problemCount);

    // 기존 점수 확인
    const { data: existing } = await supabase
      .from("level_scores")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .eq("level", level)
      .single();

    let result;
    if (existing) {
      // 업데이트
      result = await executeSupabaseQuery(async () => {
        return await supabase
          .from("level_scores")
          .update({
            problem_count: problemCount,
            score,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();
      });
    } else {
      // 생성
      result = await executeSupabaseQuery(async () => {
        return await supabase
          .from("level_scores")
          .insert({
            party_id: partyId,
            user_id: userId,
            level,
            problem_count: problemCount,
            score,
          })
          .select()
          .single();
      });
    }

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
