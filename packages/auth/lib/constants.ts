// NextAuth 관련 상수
export const AUTH_COOKIE_NAME = "authjs.session-token";

export const AUTH_PAGES = {
  signIn: "/login",
  signOut: "/",
  error: "/error",
} as const;

export const PROTECTED_ROUTES = ["/dashboard", "/party"] as const;

// 크루 관련 상수
/**
 * 기본 크루 ID: "클IE밍"
 * 모든 신규 사용자는 이 크루에 자동으로 추가됩니다.
 */
export const DEFAULT_CREW_ID = "5425969c-1392-48ea-a577-dcae2766bf74";
