import { NextResponse } from "next/server";
import { createAdminClient } from "@pkg/supabase/server";
import { executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 파티 상태 자동 업데이트 API (Cron Job용)
 *
 * 외부 스케줄러(예: Vercel Cron, AWS EventBridge)에서 주기적으로 호출
 * 또는 Supabase pg_cron이 활성화되지 않은 경우 사용
 *
 * GET /api/cron/update-party-status
 *
 * 보안: 환경변수로 cron secret을 확인하여 인증
 */
export async function GET(request: Request): Promise<Response> {
  try {
    // Cron secret 인증 (환경변수에서 확인)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client initialization failed" }, { status: 500 });
    }

    // 파티 상태 자동 업데이트
    const now = new Date().toISOString();

    // 시작 시간이 된 파티를 'running'으로 변경
    // 조건: status가 'draft' 또는 'ready'이고, start_at <= 현재 시간, end_at이 없거나 end_at > 현재 시간
    const partiesToStart = await supabase
      .from("parties")
      .select("id, name, status, start_at, end_at")
      .in("status", ["draft", "ready"])
      .not("start_at", "is", null)
      .lte("start_at", now);

    let startedCount = 0;
    let startedParties: any[] = [];

    if (partiesToStart.data) {
      // end_at 조건을 필터링 (Supabase 쿼리 빌더로는 복잡하므로 직접 필터링)
      const validParties = partiesToStart.data.filter(
        (party) => !party.end_at || new Date(party.end_at) > new Date(now),
      );

      if (validParties.length > 0) {
        const startResult = await supabase
          .from("parties")
          .update({ status: "running" })
          .in(
            "id",
            validParties.map((p) => p.id),
          )
          .select("id, name, status");

        if (startResult.data) {
          startedCount = startResult.data.length;
          startedParties = startResult.data;
        }
      }
    }

    // 종료 시간이 된 파티를 'ended'로 변경
    const endResult = await supabase
      .from("parties")
      .update({ status: "ended" })
      .eq("status", "running")
      .not("end_at", "is", null)
      .lte("end_at", now)
      .select("id, name, status");

    const result = {
      started: startedParties,
      ended: endResult.data || [],
      startedCount,
      endedCount: endResult.data?.length || 0,
    };

    return NextResponse.json({
      success: true,
      message: "Party status updated successfully",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("파티 상태 업데이트 에러:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
