import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { executeSupabaseQuery, successResponse, errorResponse } from "@pkg/supabase/api-helpers";

/**
 * Supabase 연결 테스트 API
 * GET /api/supabase/test?admin=true (강제 관리자 모드)
 * 로그인한 사용자의 role이 'admin'이면 자동으로 관리자 모드 사용
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceAdmin = searchParams.get("admin") === "true";

    // 1. 세션 확인 및 관리자 권한 체크
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string | null })?.role;
    const isAdmin = userRole === "admin";
    const useAdmin = forceAdmin || isAdmin;

    // 2. 클라이언트 생성 (일반 또는 관리자)
    let supabase;
    let clientType = "일반 (RLS 적용)";
    let adminReason = "";

    if (useAdmin) {
      try {
        supabase = createAdminClient();
        if (isAdmin && !forceAdmin) {
          clientType = "관리자 (RLS 우회) - 자동 적용";
          adminReason =
            "로그인한 사용자가 관리자 권한을 가지고 있어 자동으로 관리자 모드가 적용되었습니다.";
        } else {
          clientType = "관리자 (RLS 우회) - 강제 모드";
          adminReason = "관리자 모드가 강제로 활성화되었습니다.";
        }
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "관리자 클라이언트 생성 실패",
          500,
        );
      }
    } else {
      supabase = await createServerClient();
      if (session && !isAdmin) {
        adminReason = `현재 사용자 role: ${userRole || "없음"}. 관리자 권한이 없어 일반 모드로 실행됩니다.`;
      } else if (!session) {
        adminReason = "로그인하지 않았습니다. 일반 모드로 실행됩니다.";
      }
    }

    // 2. 연결 테스트 (간단한 쿼리 실행)
    const result = await executeSupabaseQuery(async () => {
      const { data, error } = await supabase.from("users").select("*").limit(10);
      return { data, error };
    });

    // 3. 환경변수 확인
    const envCheck = {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`
        : "없음",
    };

    // 4. RLS 정보 확인
    const rlsInfo = {
      clientType,
      userRole: userRole || "없음",
      isAdmin,
      note: useAdmin
        ? adminReason || "관리자 모드: RLS 정책을 우회하여 모든 데이터에 접근 가능"
        : adminReason || "일반 모드: RLS 정책이 적용됩니다. 빈 배열이면 RLS 정책을 확인하세요.",
      dataCount: Array.isArray(result.data) ? result.data.length : 0,
    };

    return successResponse({
      connection: result.success ? "성공" : "실패",
      error: result.error,
      data: result.data,
      environment: envCheck,
      rlsInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Supabase 테스트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "알 수 없는 오류", 500);
  }
}

/**
 * Supabase 쿼리 테스트 API
 * POST /api/supabase/test
 * body: { table, action, data?, useAdmin?: boolean }
 * 로그인한 사용자의 role이 'admin'이면 자동으로 관리자 모드 사용
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, action, data: requestData, useAdmin: forceAdmin = false } = body;

    if (!table || !action) {
      return errorResponse("table과 action이 필요합니다", 400);
    }

    // 세션 확인 및 관리자 권한 체크
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string | null })?.role;
    const isAdmin = userRole === "admin";
    const useAdmin = forceAdmin || isAdmin;

    // 클라이언트 생성 (일반 또는 관리자)
    let supabase;
    if (useAdmin) {
      try {
        supabase = createAdminClient();
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "관리자 클라이언트 생성 실패",
          500,
        );
      }
    } else {
      supabase = await createServerClient();
    }

    let result;

    switch (action) {
      case "select":
        result = await executeSupabaseQuery(async () => {
          return await supabase.from(table).select("*").limit(10);
        });
        break;

      case "insert":
        if (!requestData) {
          return errorResponse("insert 작업에는 data가 필요합니다", 400);
        }
        result = await executeSupabaseQuery(async () => {
          return await supabase.from(table).insert(requestData).select();
        });
        break;

      case "update":
        if (!requestData || !requestData.id) {
          return errorResponse("update 작업에는 data와 id가 필요합니다", 400);
        }
        {
          const { id, ...updateData } = requestData;
          result = await executeSupabaseQuery(async () => {
            return await supabase.from(table).update(updateData).eq("id", id).select();
          });
        }
        break;

      case "delete":
        if (!requestData || !requestData.id) {
          return errorResponse("delete 작업에는 data.id가 필요합니다", 400);
        }
        result = await executeSupabaseQuery(async () => {
          return await supabase.from(table).delete().eq("id", requestData.id);
        });
        break;

      default:
        return errorResponse(`지원하지 않는 action: ${action}`, 400);
    }

    // 결과에 RLS 정보 추가
    if (result.success && result.data !== null) {
      return successResponse({
        data: result.data,
        rlsInfo: {
          clientType: useAdmin
            ? isAdmin && !forceAdmin
              ? "관리자 (RLS 우회) - 자동 적용"
              : "관리자 (RLS 우회) - 강제 모드"
            : "일반 (RLS 적용)",
          userRole: userRole || "없음",
          isAdmin,
          dataCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
        },
      });
    }

    const errorMessage = result.error?.message || "데이터베이스 작업 중 오류가 발생했습니다";
    const status = result.error?.code === "PGRST116" ? 404 : 500;

    return errorResponse(errorMessage, status, result.error?.code);
  } catch (error) {
    console.error("Supabase 쿼리 테스트 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "알 수 없는 오류", 500);
  }
}
