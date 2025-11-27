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
    const body = await request.json();
    const { code, level } = body;

    if (!code) {
      return errorResponse("파티 코드가 필요합니다", 400);
    }

    // 3. Supabase 클라이언트 생성
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

    // 4. 파티 코드로 파티 조회
    const { data: party, error: partyError } = await supabase
      .from("parties")
      .select("id, name, status, start_at, end_at")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (partyError || !party) {
      return errorResponse("유효하지 않은 파티 코드입니다", 404);
    }

    // 5. 이미 참가한 파티인지 확인
    const { data: existingMember, error: existingMemberError } = await supabase
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

    // 6. 사용자의 base_level 조회
    const { data: user, error: userError } = await supabase
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
    console.error("파티 참가 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
