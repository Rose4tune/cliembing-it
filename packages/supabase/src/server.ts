import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * 서버 환경에서 사용하는 Supabase 클라이언트
 * RLS 정책이 적용됩니다.
 *
 * 주의: NextAuth를 사용하는 경우 auth.uid()가 null일 수 있습니다.
 * 이 경우 RLS 정책에서 public.users 테이블을 직접 참조하도록 수정해야 합니다.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서는 쿠키 설정이 안 될 수 있음
          }
        },
      },
    },
  );
}

/**
 * 사용자 ID를 명시적으로 설정한 Supabase 클라이언트
 * NextAuth 세션의 사용자 ID를 RLS 정책에서 사용할 수 있도록 설정
 *
 * @param userId - public.users 테이블의 사용자 ID
 */
export async function createServerClientWithUser(userId: string) {
  const cookieStore = await cookies();

  const client = createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서는 쿠키 설정이 안 될 수 있음
          }
        },
      },
      global: {
        headers: {
          // 사용자 ID를 헤더로 전달 (Supabase RPC 함수에서 사용)
          "x-user-id": userId,
        },
      },
    },
  );

  return client;
}

/**
 * 서버 환경에서 사용하는 Supabase 관리자 클라이언트
 * Service Role Key를 사용하여 RLS 정책을 우회합니다.
 * 주의: 관리자 권한이므로 신중하게 사용해야 합니다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL이 설정되지 않음");
  }

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 설정되지 않음 (관리자 권한 필요)",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
