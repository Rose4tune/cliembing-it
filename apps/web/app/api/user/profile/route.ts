import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import { numberToLevel, levelToNumber, type ClimbingLevel } from "@pkg/shared";

/**
 * 사용자 프로필 조회 API
 * GET /api/user/profile
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
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

    // 사용자 정보 조회
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("users")
        .select("id, nickname, email, base_level, mbti, created_at")
        .eq("id", userId)
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse("사용자 정보를 찾을 수 없습니다", 404);
    }

    const user = result.data;
    const level = numberToLevel(user.base_level);

    // 참가한 파티 목록 조회
    const { data: parties } = await supabase
      .from("party_members")
      .select(
        `
        party_id,
        parties (
          id,
          name,
          status,
          start_at,
          end_at,
          created_at
        )
      `,
      )
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(10);

    return successResponse({
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        baseLevel: user.base_level,
        level: level,
        mbti: user.mbti,
        createdAt: user.created_at,
      },
      parties:
        parties?.map((p: any) => ({
          id: p.parties?.id,
          name: p.parties?.name,
          status: p.parties?.status,
          startAt: p.parties?.start_at,
          endAt: p.parties?.end_at,
          createdAt: p.parties?.created_at,
        })) || [],
    });
  } catch (error) {
    console.error("프로필 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 사용자 프로필 수정 API
 * PATCH /api/user/profile
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    // 요청 데이터 파싱
    const body = await request.json();
    const { nickname, email, level } = body;

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

    // 업데이트할 데이터 준비
    const updateData: {
      nickname?: string;
      email?: string;
      base_level?: number | null;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (nickname !== undefined) {
      updateData.nickname = nickname.trim();
    }

    if (email !== undefined) {
      updateData.email = email.trim() || null;
    }

    if (level !== undefined) {
      // ClimbingLevel을 숫자로 변환
      if (level === null) {
        updateData.base_level = null;
      } else {
        const levelNumber = levelToNumber(level as ClimbingLevel);
        updateData.base_level = levelNumber;
      }
    }

    // 사용자 정보 업데이트
    const result = await executeSupabaseQuery(async () => {
      return await supabase.from("users").update(updateData).eq("id", userId).select().single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "프로필 수정에 실패했습니다", 500);
    }

    const user = result.data;
    const updatedLevel = numberToLevel(user.base_level);

    return successResponse({
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        baseLevel: user.base_level,
        level: updatedLevel,
        mbti: user.mbti,
        createdAt: user.created_at,
      },
      message: "프로필이 수정되었습니다",
    });
  } catch (error) {
    console.error("프로필 수정 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
