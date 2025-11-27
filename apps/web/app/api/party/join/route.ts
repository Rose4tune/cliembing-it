import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";
import { numberToLevel, type ClimbingLevel } from "@pkg/shared";

/**
 * 파티 참가 API
 * POST /api/party/join
 */
export async function POST(request: Request) {
  // 함수가 실행되는지 확인하기 위한 로그
  console.log("[API] /api/party/join POST 요청 수신");
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    // 2. 요청 데이터 파싱
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("요청 본문 파싱 에러:", parseError);
      return errorResponse("잘못된 요청 형식입니다", 400);
    }

    const { code, level } = body;

    if (!code || typeof code !== "string") {
      return errorResponse("파티 코드가 필요합니다", 400);
    }

    // 3. Supabase 클라이언트 생성
    // 파티 코드로 조회할 때는 RLS 정책을 우회하기 위해 Service Role Key 사용
    // (RLS 정책이 crew_members에 속한 사용자만 조회 가능하도록 되어 있어서,
    //  파티 참가 전에는 해당 크루 멤버가 아닐 수 있음)
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    let supabaseForQuery;

    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
        supabaseForQuery = supabase;
      } else {
        // 파티 조회는 Service Role Key 사용 (RLS 우회)
        supabaseForQuery = createAdminClient();
        // 나머지 작업은 일반 클라이언트 사용
        supabase = await createServerClient();
      }
    } catch (error) {
      console.error("Supabase 클라이언트 생성 에러:", error);
      try {
        // 파티 조회는 Service Role Key 사용
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

    // 4. 파티 코드로 파티 조회 (Service Role Key 사용하여 RLS 우회)
    const trimmedCode = code.trim().toUpperCase();
    console.log("[API] 파티 조회 시도:", { code: trimmedCode, userId, userRole });

    const { data: party, error: partyError } = await supabaseForQuery
      .from("parties")
      .select("id, name, status, start_at, end_at")
      .eq("code", trimmedCode)
      .maybeSingle();

    console.log("[API] 파티 조회 결과:", {
      hasParty: !!party,
      hasError: !!partyError,
      errorCode: partyError?.code,
      errorMessage: partyError?.message,
      errorDetails: partyError?.details,
    });

    if (partyError) {
      console.error("파티 조회 에러:", {
        code: trimmedCode,
        error: partyError,
        userId,
        userRole,
      });

      // RLS 정책 문제일 가능성
      if (partyError.code === "PGRST301" || partyError.message?.includes("permission")) {
        return errorResponse("파티 조회 권한이 없습니다", 403);
      }

      return errorResponse("파티 조회 중 오류가 발생했습니다", 500);
    }

    if (!party) {
      console.warn("파티를 찾을 수 없음:", { code: trimmedCode, userId });

      // RLS 정책으로 인해 결과가 필터링되었을 가능성 확인
      // 모든 파티 코드로 테스트 쿼리 실행 (디버깅용)
      const { data: allParties, error: testError } = await supabaseForQuery
        .from("parties")
        .select("code")
        .limit(5);

      console.log("[API] 파티 조회 테스트:", {
        testError: testError?.message,
        availableCodes: allParties?.map((p) => p.code),
      });

      return errorResponse("유효하지 않은 파티 코드입니다", 404);
    }

    // 5. 이미 참가한 파티인지 확인 (Service Role Key 사용하여 RLS 우회)
    const { data: existingMember, error: existingMemberError } = await supabaseForQuery
      .from("party_members")
      .select("id")
      .eq("party_id", party.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMemberError) {
      console.error("파티 멤버 확인 에러:", existingMemberError);
      return errorResponse("파티 참가 확인 중 오류가 발생했습니다", 500);
    }

    if (existingMember) {
      return errorResponse("이미 참가한 파티입니다", 400);
    }

    // 6. 사용자의 base_level 조회 (Service Role Key 사용하여 RLS 우회)
    const { data: user, error: userError } = await supabaseForQuery
      .from("users")
      .select("base_level")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("사용자 조회 에러:", userError);
      return errorResponse("사용자 정보를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.", 500);
    }

    // 사용자가 아직 생성되지 않은 경우 (새로운 유저 로그인 직후)
    if (!user) {
      return errorResponse(
        "사용자 정보가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.",
        503,
      );
    }

    // 7. 레벨 결정: level 파라미터가 있으면 사용, 없으면 base_level 사용
    let finalLevel: ClimbingLevel | null = null;

    if (level) {
      // API에서 받은 레벨 사용
      finalLevel = level as ClimbingLevel;
    } else if (user?.base_level) {
      // base_level을 ClimbingLevel로 변환
      finalLevel = numberToLevel(user.base_level);
    }

    // 8. 파티 멤버 추가
    const memberData: {
      party_id: string;
      user_id: string;
      role: string;
      joined_at: string;
      level?: string | null;
    } = {
      party_id: party.id,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
    };

    if (finalLevel) {
      memberData.level = finalLevel;
    }

    const result = await executeSupabaseQuery(async () => {
      return await supabase.from("party_members").insert(memberData).select().single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "파티 참가에 실패했습니다", 500);
    }

    return successResponse({
      party: {
        id: party.id,
        name: party.name,
        status: party.status,
      },
      member: result.data,
      requiresLevel: !finalLevel, // 레벨이 없으면 true 반환
      message: finalLevel
        ? "파티에 성공적으로 참가했습니다"
        : "파티에 참가했습니다. 레벨을 설정해주세요.",
    });
  } catch (error) {
    console.error("파티 참가 에러:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
