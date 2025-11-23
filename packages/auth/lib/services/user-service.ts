import {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "./supabase-client";
import { supabaseLogger } from "../logger";
import { DEFAULT_CREW_ID } from "../constants";

export interface UserData {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface SupabaseUser {
  id: string;
  provider_id: string;
  nickname: string;
  email: string | null;
  auth_provider: string;
  mbti: string | null;
  base_level: number | null;
  role: string;
}

/**
 * 통합 사용자 서비스
 * Supabase users 테이블 CRUD 로직
 */
export const userService = {
  /**
   * provider_id로 사용자 조회
   */
  async getUserByProviderId(providerId: string): Promise<SupabaseUser | null> {
    const supabase = createSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("users")
      .select(
        "id, provider_id, nickname, email, auth_provider, mbti, base_level, role",
      )
      .eq("provider_id", providerId)
      .single();

    if (error) {
      supabaseLogger.error("사용자 조회 실패", error);
      return null;
    }

    return data;
  },

  /**
   * 카카오 로그인 시 사용자 동기화 (생성 또는 업데이트)
   */
  async syncUser(kakaoId: string, user: UserData): Promise<string | null> {
    supabaseLogger.sync("사용자 동기화 시작", { kakaoId, email: user.email });

    const supabase = createSupabaseClient();
    if (!supabase) return null;

    try {
      // 1. 카카오 ID로 기존 사용자 확인
      const { data: existingByKakaoId } = await supabase
        .from("users")
        .select("id, nickname, email, provider_id")
        .eq("provider_id", kakaoId)
        .eq("auth_provider", "kakao")
        .limit(1)
        .single();

      if (existingByKakaoId) {
        supabaseLogger.success(
          `기존 사용자 발견 - 정보 유지: ${existingByKakaoId.id}`,
        );
        return existingByKakaoId.id;
      }

      // 2. 이메일로 확인 (provider_id 없는 기존 데이터 대응)
      if (user.email) {
        const { data: existingByEmail } = await supabase
          .from("users")
          .select("id, nickname, email, provider_id")
          .eq("email", user.email)
          .limit(1)
          .single();

        if (existingByEmail) {
          supabaseLogger.sync(
            "이메일로 기존 사용자 발견, provider_id만 업데이트",
          );

          const { error: updateError } = await supabase
            .from("users")
            .update({
              provider_id: kakaoId,
              auth_provider: "kakao",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingByEmail.id);

          if (updateError) {
            supabaseLogger.error("provider_id 업데이트 실패", updateError);
          } else {
            supabaseLogger.success("provider_id 업데이트 완료");
          }

          return existingByEmail.id;
        }
      }

      // 3. 신규 사용자 생성
      const { randomUUID } = await import("crypto");
      const userId = randomUUID();

      supabaseLogger.sync("신규 사용자 생성", { userId, kakaoId });

      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          id: userId,
          provider_id: kakaoId,
          nickname: user.name || "카카오사용자",
          email: user.email,
          auth_provider: "kakao",
          default_crew_id: DEFAULT_CREW_ID, // 기본 크루 "클IE밍"에 자동 할당
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        supabaseLogger.error("사용자 생성 실패", insertError);
        return null;
      }

      supabaseLogger.success(`사용자 생성 완료: ${newUser.id}`);

      // 4. profiles 테이블 생성
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ user_id: userId });

      if (profileError && profileError.code !== "23505") {
        supabaseLogger.error("프로필 생성 실패", profileError);
      } else {
        supabaseLogger.success("프로필 생성 완료");
      }

      // 5. crew_members 테이블에 자동 추가 (기본 크루 "클IE밍"에 멤버로 추가)
      const { error: crewMemberError } = await supabase
        .from("crew_members")
        .insert({
          crew_id: DEFAULT_CREW_ID,
          user_id: userId,
          role: "member", // 기본 역할은 member
          joined_at: new Date().toISOString(),
        });

      if (crewMemberError && crewMemberError.code !== "23505") {
        supabaseLogger.error("크루 멤버 추가 실패", crewMemberError);
      } else {
        supabaseLogger.success("크루 멤버 추가 완료");
      }

      return userId;
    } catch (error) {
      supabaseLogger.error("동기화 중 예외 발생", error);
      return null;
    }
  },

  /**
   * 사용자 삭제 (profiles는 CASCADE로 자동 삭제)
   */
  async deleteUser(userId: string): Promise<boolean> {
    supabaseLogger.sync("사용자 삭제 시작", { userId });

    const supabase = createSupabaseAdminClient();
    if (!supabase) return false;

    try {
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", userId);

      if (deleteError) {
        supabaseLogger.error("사용자 삭제 실패", deleteError);
        return false;
      }

      supabaseLogger.success("사용자 삭제 완료");
      return true;
    } catch (error) {
      supabaseLogger.error("사용자 삭제 중 예외 발생", error);
      return false;
    }
  },
};
