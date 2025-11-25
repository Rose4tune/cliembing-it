/**
 * 랭킹 계산 큐 서비스
 * 이벤트 기반 비동기 랭킹 계산을 위한 큐 관리
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// executeSupabaseQuery는 api-helpers에서 가져오지만,
// shared 패키지에서는 직접 구현하거나 다른 방법 사용
async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
): Promise<{ success: boolean; data?: T; error?: any }> {
  try {
    const result = await queryFn();
    if (result.error) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data as T };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * 랭킹 계산 큐에 이벤트 추가
 */
export async function enqueueRankingCalculation(
  supabase: SupabaseClient,
  partyId: string,
  priority: number = 0,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await executeQuery(async () => {
      return await supabase
        .from("ranking_calculation_queue")
        .insert({
          party_id: partyId,
          status: "pending",
          priority,
        })
        .select()
        .single();
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "큐에 추가하는데 실패했습니다",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 랭킹 계산 큐에서 다음 작업 가져오기 (워커용)
 */
export async function dequeueRankingCalculation(
  supabase: SupabaseClient,
): Promise<{
  success: boolean;
  item?: {
    id: string;
    party_id: string;
  };
  error?: string;
}> {
  try {
    // pending 상태인 가장 우선순위 높은 작업 가져오기
    const result = await executeQuery(async () => {
      return await supabase
        .from("ranking_calculation_queue")
        .select("id, party_id")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: "대기 중인 작업이 없습니다",
      };
    }

    // 상태를 processing으로 변경
    const updateResult = await executeQuery(async () => {
      return await supabase
        .from("ranking_calculation_queue")
        .update({
          status: "processing",
          processed_at: new Date().toISOString(),
        })
        .eq("id", result.data!.id)
        .select()
        .single();
    });

    if (!updateResult.success) {
      return {
        success: false,
        error: "작업 상태 업데이트 실패",
      };
    }

    return {
      success: true,
      item: {
        id: result.data!.id,
        party_id: result.data!.party_id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 랭킹 계산 완료 처리
 */
export async function completeRankingCalculation(
  supabase: SupabaseClient,
  queueId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await executeQuery(async () => {
      return await supabase
        .from("ranking_calculation_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId)
        .select()
        .single();
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "완료 처리 실패",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * 랭킹 계산 실패 처리
 */
export async function failRankingCalculation(
  supabase: SupabaseClient,
  queueId: string,
  errorMessage: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await executeQuery(async () => {
      return await supabase
        .from("ranking_calculation_queue")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId)
        .select()
        .single();
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "실패 처리 실패",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
