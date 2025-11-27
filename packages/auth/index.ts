// NextAuth 핵심
export { handlers } from "./lib/auth";
export { authOptions } from "./lib/options";
export { getProviders } from "./lib/providers";
export { callbacks } from "./lib/callbacks";

// 상수
export {
  AUTH_PAGES,
  AUTH_COOKIE_NAME,
  PROTECTED_ROUTES,
  DEFAULT_CREW_ID,
} from "./lib/constants";

// 로거
export { authLogger, supabaseLogger } from "./lib/logger";

// 서비스 레이어
export { userService } from "./lib/services/user-service";
export {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "./lib/services/supabase-client";

// 타입
export type { KakaoProfile } from "./types/kakao";
export type {
  SupabaseUser,
  UserData,
  CreateUserInput,
  UpdateUserInput,
} from "./types/user";
export { isKakaoProfile, extractKakaoUserInfo } from "./types/kakao";

// v4 API
export { getServerSession } from "next-auth";

// 디버깅 도구 (개발 환경에서만 사용)
export { testSupabaseConnection } from "./lib/supabase-test";

// 하위 호환성 (deprecated)
export { userService as syncUserToSupabase } from "./lib/services/user-service";
export { userService as deleteUserFromSupabase } from "./lib/services/user-service";
