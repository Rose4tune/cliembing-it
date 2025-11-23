/**
 * Supabase 패키지 메인 export
 */

// 클라이언트
export { createClient } from "./client";

// 서버 클라이언트
export { createServerClient } from "./server";

// 유틸리티
export {
  formatSupabaseError,
  normalizeSupabaseResult,
  executeSupabaseQuery,
  type SupabaseError,
  type SupabaseResult,
} from "./utils";

// API 헬퍼
export {
  successResponse,
  errorResponse,
  handleSupabaseResult,
  requireAuth,
  type ApiResponse,
} from "./api-helpers";
