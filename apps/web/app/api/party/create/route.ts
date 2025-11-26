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
    const { name, description, date, time, endDate, endTime, location, maxParticipants } = body;

    if (!name || !date || !time || !endDate || !endTime || !location) {
      return errorResponse("필수 항목이 누락되었습니다", 400);
    }

    // 4. 날짜/시간 결합
    const startAt = new Date(`${date}T${time}`).toISOString();
    const endAt = new Date(`${endDate}T${endTime}`).toISOString();

    // 종료 시간이 시작 시간보다 이전이면 에러
    if (new Date(endAt) <= new Date(startAt)) {
      return errorResponse("종료 시간은 시작 시간보다 나중이어야 합니다", 400);
    }

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
    } catch {
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
          status: "ready", // 초기 상태는 "ready" (대기중)
          start_at: startAt,
          end_at: endAt, // 종료 시간 (필수)
          total_participants: maxParticipants || null,
          description: description?.trim() || null, // description 추가
        })
        .select()
        .single();
    });

    if (!result.success || !result.data) {
      return errorResponse(result.error?.message || "파티 생성에 실패했습니다", 500);
    }

    const partyId = (result.data as { id: string }).id;

    // 9. 파티 생성자를 party_members에 자동 추가 (role: 'admin' 또는 'leader')
    const memberResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_members")
        .insert({
          party_id: partyId,
          user_id: userId,
          role: "admin", // 파티 생성자는 관리자 역할로 설정 (enum 값에 따라 조정 가능)
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();
    });

    if (!memberResult.success) {
      // 파티는 생성되었지만 멤버 추가 실패 - 경고만 로그하고 파티는 반환
      console.warn(
        "파티 생성자는 자동으로 추가되었지만 멤버 등록에 실패했습니다:",
        memberResult.error,
      );
    }

    // 10. party_ruleset 레코드 생성 (기본 점수 설정)
    const defaultLevelPoints = {
      Grip: {
        self: 5,
        above: 10,
      },
      Crux: {
        White: {
          self: 4,
          above: 10,
        },
        Hite: {
          Purple: 3,
          White: 7,
        },
      },
    };

    const rulesetResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("party_ruleset")
        .insert({
          party_id: partyId,
          level_points: defaultLevelPoints,
          height_thresholds: [], // 기본값: 빈 배열 (필요시 추후 설정)
          line_bonus: 10, // 기본값
        })
        .select()
        .single();
    });

    if (!rulesetResult.success) {
      // 파티는 생성되었지만 ruleset 추가 실패 - 경고만 로그하고 파티는 반환
      console.warn("파티가 생성되었지만 점수 규칙 설정에 실패했습니다:", rulesetResult.error);
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
