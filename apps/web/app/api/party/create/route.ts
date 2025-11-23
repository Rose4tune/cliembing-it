import { NextResponse } from "next/server";
import { getServerSession, authOptions, DEFAULT_CREW_ID } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 생성 API
 * POST /api/party/create
 *
 * 요구사항:
 * - 관리자 권한 필요 (role = 'admin')
 * - 모든 파티는 기본 크루 "클IE밍"에 속함
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

    // 2. 관리자 권한 확인
    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("파티 생성은 관리자만 가능합니다", 403);
    }

    // 3. 요청 데이터 파싱
    const body = await request.json();
    const { name, description, date, time, location, maxParticipants } = body;

    if (!name || !date || !time || !location) {
      return errorResponse("필수 항목이 누락되었습니다", 400);
    }

    // 4. 날짜/시간 결합
    const startAt = new Date(`${date}T${time}`).toISOString();

    // 5. 파티 코드 생성 (간단한 랜덤 코드)
    const generatePartyCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 가능한 문자 제외
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // 6. Supabase 클라이언트 생성 (관리자 권한이 있으므로 관리자 클라이언트 사용)
    let supabase;
    try {
      supabase = createAdminClient();
    } catch (error) {
      // Service Role Key가 없으면 일반 클라이언트 사용 (RLS 정책 적용)
      supabase = await createServerClient();
    }

    // 7. 고유한 파티 코드 생성 (중복 체크)
    let partyCode = generatePartyCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from("parties")
        .select("id")
        .eq("code", partyCode)
        .single();

      if (!existing) {
        break; // 사용 가능한 코드
      }
      partyCode = generatePartyCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return errorResponse("파티 코드 생성에 실패했습니다. 다시 시도해주세요.", 500);
    }

    // 8. 파티 생성
    const result = await executeSupabaseQuery(async () => {
      return await supabase
        .from("parties")
        .insert({
          name: name.trim(),
          code: partyCode,
          crew_id: DEFAULT_CREW_ID, // 기본 크루 "클IE밍"
          created_by: userId,
          status: "draft", // 초기 상태는 "draft" (초안)
          start_at: startAt,
          total_participants: maxParticipants || null,
          description: description?.trim() || null, // description 추가
        })
        .select()
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "파티 생성에 실패했습니다", 500);
    }

    return successResponse({
      party: result.data,
      message: "파티가 성공적으로 생성되었습니다",
    });
  } catch (error) {
    console.error("파티 생성 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
