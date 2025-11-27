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
  // 함수가 실행되는지 확인하기 위한 로그
  console.log("[API] /api/user/profile GET 요청 수신");
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
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // 자신의 정보를 조회할 때는 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // 사용자 정보 조회는 Service Role Key 사용 (RLS 우회)
        supabaseForQuery = createAdminClient();
        // 나머지 작업은 일반 클라이언트 사용
        supabase = await createServerClient();
      }
    } catch (error) {
      console.error("Supabase 클라이언트 생성 에러:", error);
      try {
        // 사용자 정보 조회는 Service Role Key 사용
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

    // 사용자 정보 조회 (Service Role Key 사용하여 RLS 우회)
    const result = await executeSupabaseQuery<{
      id: string;
      nickname: string | null;
      email: string | null;
      base_level: number | null;
      mbti: string | null;
      created_at: string;
    }>(async () => {
      return await supabaseForQuery
        .from("users")
        .select("id, nickname, email, base_level, mbti, created_at")
        .eq("id", userId)
        .maybeSingle();
    });

    if (!result.success) {
      console.error("사용자 조회 에러:", result.error);
      return errorResponse("사용자 정보를 조회할 수 없습니다", 500);
    }

    if (!result.data) {
      console.warn("사용자를 찾을 수 없음:", { userId });
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
    console.error("프로필 조회 에러:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("요청 본문 파싱 에러:", parseError);
      return errorResponse("잘못된 요청 형식입니다", 400);
    }

    const { nickname, email, level } = body;

    // Supabase 클라이언트 생성
    // NextAuth 사용 시 auth.uid()가 null이므로 RLS 정책을 우회하기 위해
    // 자신의 정보를 수정할 때는 Service Role Key 사용
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForUpdate;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForUpdate = supabase;
      } else {
        // 사용자 정보 수정은 Service Role Key 사용 (RLS 우회)
        supabaseForUpdate = createAdminClient();
        // 나머지 작업은 일반 클라이언트 사용
        supabase = await createServerClient();
      }
    } catch (error) {
      console.error("Supabase 클라이언트 생성 에러:", error);
      try {
        // 사용자 정보 수정은 Service Role Key 사용
        supabaseForUpdate = createAdminClient();
        supabase = await createServerClient();
      } catch (fallbackError) {
        console.error("Supabase 클라이언트 생성 실패:", fallbackError);
        return errorResponse("데이터베이스 연결에 실패했습니다", 500);
      }
    }

    if (!supabase || !supabaseForUpdate) {
      return errorResponse("데이터베이스 연결에 실패했습니다", 500);
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
    const result = await executeSupabaseQuery<{
      id: string;
      nickname: string | null;
      email: string | null;
      base_level: number | null;
      mbti: string | null;
      created_at: string;
    }>(async () => {
      return await supabaseForUpdate
        .from("users")
        .update(updateData)
        .eq("id", userId)
        .select()
        .single();
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
    console.error("프로필 수정 에러:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
