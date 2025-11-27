import { getServerSession, authOptions, DEFAULT_CREW_ID } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

// 중복 요청 방지를 위한 간단한 인메모리 캐시 (서버 재시작 시 초기화됨)
const pendingRequests = new Map<string, Promise<any>>();

/**
 * 파티 생성 API
 * POST /api/party/create
 *
 * 요구사항:
 * - 관리자 권한 필요 (role = 'admin')
 * - 모든 파티는 기본 크루 "클IE밍"에 속함
 * - 중복 요청 방지: 동일한 사용자의 동시 요청은 하나만 처리
 */
export async function POST(request: Request) {
  let userId: string | null = null;
  let requestKey: string | null = null;

  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    userId = (session.user as { id?: string })?.id || null;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    // 2. 중복 요청 방지: 동일 사용자의 진행 중인 요청이 있으면 에러 반환
    requestKey = `party_create_${userId}`;
    if (pendingRequests.has(requestKey)) {
      return errorResponse("파티 생성 요청이 이미 처리 중입니다. 잠시 후 다시 시도해주세요.", 429);
    }

    // 3. 관리자 권한 확인
    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("파티 생성은 관리자만 가능합니다", 403);
    }

    // 4. 요청 데이터 파싱
    const body = await request.json();
    const { name, description, date, time, endDate, endTime, location, maxParticipants } = body;

    if (!name || !date || !time || !endDate || !endTime || !location) {
      return errorResponse("필수 항목이 누락되었습니다", 400);
    }

    // 5. 날짜/시간 결합
    const startAt = new Date(`${date}T${time}`).toISOString();
    const endAt = new Date(`${endDate}T${endTime}`).toISOString();

    // 종료 시간이 시작 시간보다 이전이면 에러
    if (new Date(endAt) <= new Date(startAt)) {
      return errorResponse("종료 시간은 시작 시간보다 나중이어야 합니다", 400);
    }

    // 6. 파티 코드 생성 (간단한 랜덤 코드)
    const generatePartyCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 가능한 문자 제외
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // 7. Supabase 클라이언트 생성 (관리자 권한이 있으므로 관리자 클라이언트 사용)
    let supabase;
    try {
      supabase = createAdminClient();
    } catch {
      // Service Role Key가 없으면 일반 클라이언트 사용 (RLS 정책 적용)
      supabase = await createServerClient();
    }

    // 8. 고유한 파티 코드 생성 (중복 체크)
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

    // 9. 파티 생성 (중복 요청 방지를 위해 Promise로 래핑)
    if (!userId || !requestKey) {
      return errorResponse("요청 처리 중 오류가 발생했습니다", 500);
    }

    const createPartyPromise = executeSupabaseQuery(async () => {
      return await supabase
        .from("parties")
        .insert({
          name: name.trim(),
          code: partyCode,
          crew_id: DEFAULT_CREW_ID, // 기본 크루 "클IE밍"
          created_by: userId!,
          status: "ready", // 초기 상태는 "ready" (대기중)
          start_at: startAt,
          end_at: endAt, // 종료 시간 (필수)
          total_participants: maxParticipants || null,
          description: description?.trim() || null, // description 추가
        })
        .select()
        .single();
    })
      .then(async (result) => {
        // 요청 완료 후 캐시에서 제거
        if (requestKey) {
          pendingRequests.delete(requestKey);
        }

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || "파티 생성에 실패했습니다");
        }

        return result;
      })
      .catch((error) => {
        // 에러 발생 시에도 캐시에서 제거
        if (requestKey) {
          pendingRequests.delete(requestKey);
        }
        throw error;
      });

    // Promise를 캐시에 저장 (중복 요청 방지)
    pendingRequests.set(requestKey, createPartyPromise);

    const result = await createPartyPromise;

    if (!result.data) {
      throw new Error("파티 생성 결과를 받을 수 없습니다");
    }

    const partyId = (result.data as { id: string }).id;

    // 10. 파티 생성자를 party_members에 자동 추가 (role: 'admin' 또는 'leader')
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

    // 11. party_ruleset 레코드 생성 (기본 점수 설정)
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

    // 에러 발생 시에도 캐시에서 제거
    if (requestKey) {
      pendingRequests.delete(requestKey);
    }

    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
