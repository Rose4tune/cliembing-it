import { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase 에러 타입
 */
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Supabase 에러를 사용자 친화적인 형태로 변환
 */
export function formatSupabaseError(
  error: PostgrestError | null,
): SupabaseError | null {
  if (!error) return null;

  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

/**
 * Supabase 쿼리 결과 타입
 */
export interface SupabaseResult<T> {
  data: T | null;
  error: SupabaseError | null;
  success: boolean;
}

/**
 * Supabase 쿼리 결과를 표준화된 형태로 변환
 */
export function normalizeSupabaseResult<T>(
  data: T | null,
  error: PostgrestError | null,
): SupabaseResult<T> {
  return {
    data: error ? null : data,
    error: formatSupabaseError(error),
    success: !error,
  };
}

/**
 * Supabase 쿼리 실행 래퍼 (에러 핸들링 포함)
 */
export async function executeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
): Promise<SupabaseResult<T>> {
  try {
    const { data, error } = await queryFn();
    return normalizeSupabaseResult(data, error);
  } catch (err) {
    return {
      data: null,
      error: {
        message:
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다",
      },
      success: false,
    };
  }
}
