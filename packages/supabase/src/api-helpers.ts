import { NextResponse } from "next/server";
import type { SupabaseResult } from "./utils";

// Re-export utils for convenience
export { executeSupabaseQuery } from "./utils";

/**
 * API 응답 헬퍼 타입
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * 성공 응답 생성
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      data,
    },
    { status },
  );
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  error: string,
  status: number = 500,
  code?: string,
) {
  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error,
      code,
    },
    { status },
  );
}

/**
 * Supabase 결과를 API 응답으로 변환
 */
export function handleSupabaseResult<T>(
  result: SupabaseResult<T>,
  successMessage?: string,
) {
  if (result.success && result.data !== null) {
    return successResponse(result.data);
  }

  const errorMessage =
    result.error?.message || "데이터베이스 작업 중 오류가 발생했습니다";
  const status = result.error?.code === "PGRST116" ? 404 : 500;

  return errorResponse(errorMessage, status, result.error?.code);
}

/**
 * 인증 확인 헬퍼
 */
export function requireAuth(session: { user?: { id?: string } } | null) {
  if (!session || !session.user || !session.user.id) {
    return errorResponse("인증이 필요합니다", 401, "UNAUTHORIZED");
  }
  return null;
}
