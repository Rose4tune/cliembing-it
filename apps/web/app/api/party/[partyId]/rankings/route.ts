import { getServerSession, authOptions } from "@pkg/auth";
import { createServerClient, createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 랭킹 조회 API (일반 사용자용)
 * GET /api/party/[partyId]/rankings
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return errorResponse("사용자 ID를 찾을 수 없습니다", 400);
    }

    const { partyId } = await params;

    // Supabase 클라이언트 생성
    const userRole = (session.user as { role?: string | null })?.role;
    let supabase;
    try {
      if (userRole === "admin") {
        supabase = createAdminClient();
      } else {
        supabase = await createServerClient();
      }
    } catch {
      supabase = await createServerClient();
    }

    // 파티 멤버 확인
    const { data: member } = await supabase
      .from("party_members")
      .select("id")
      .eq("party_id", partyId)
      .eq("user_id", userId)
      .single();

    if (!member) {
      return errorResponse("파티에 참가하지 않았습니다", 403);
    }

    // 파티 정보 조회
    const partyResult = await executeSupabaseQuery<{
      id: string;
      name: string;
      status: string;
      start_at: string | null;
      end_at: string | null;
    }>(async () => {
      return await supabase
        .from("parties")
        .select("id, name, status, start_at, end_at")
        .eq("id", partyId)
        .single();
    });

    if (!partyResult.success || !partyResult.data) {
      return errorResponse("파티를 찾을 수 없습니다", 404);
    }

    const party = partyResult.data;

    // rankings 테이블에서 랭킹 조회 (캐시된 랭킹)
    const rankingsResult = await executeSupabaseQuery(async () => {
      return await supabase
        .from("rankings")
        .select("type, result, computed_at, updated_at")
        .eq("party_id", partyId);
    });

    // rankings 테이블에서 그룹별 랭킹 조회
    let cruxRankings: any[] = [];
    let gripRankings: any[] = [];
    let teamRankings: any[] = [];
    let challengeRankings: any[] = [];

    if (rankingsResult.success && rankingsResult.data) {
      rankingsResult.data.forEach((ranking: any) => {
        if (ranking.type === "crux") {
          cruxRankings = ranking.result || [];
        } else if (ranking.type === "grip") {
          gripRankings = ranking.result || [];
        } else if (ranking.type === "team") {
          teamRankings = ranking.result || [];
        } else if (ranking.type === "challenge") {
          challengeRankings = ranking.result || [];
        }
      });
    }

    // 그룹별 랭킹이 없으면 실시간 계산은 하지 않음 (워커가 처리)
    // 여기서는 캐시된 랭킹만 반환
    const personalRankings = [...cruxRankings, ...gripRankings].sort(
      (a, b) => b.totalScore - a.totalScore,
    );

    // 기존 실시간 계산 로직은 제거됨 (워커가 처리)

    // 팀 랭킹이 없으면 실시간 계산
    if (teamRankings.length === 0) {
      const teamsResult = await executeSupabaseQuery(async () => {
        return await supabase.from("teams").select("id, name, score").eq("party_id", partyId);
      });

      if (teamsResult.success && teamsResult.data) {
        teamRankings = teamsResult.data
          .map((team: any) => ({
            teamId: team.id,
            teamName: team.name,
            totalScore: team.score || 0,
          }))
          .sort((a, b) => b.totalScore - a.totalScore)
          .map((item, index) => ({
            ...item,
            rank: index + 1,
          }));
      }
    }

    // 파티 참가자 수 및 팀 수 계산
    const participantCountResult = await executeSupabaseQuery(async () => {
      const { count } = await supabase
        .from("party_members")
        .select("*", { count: "exact", head: true })
        .eq("party_id", partyId);
      return { data: count, error: null };
    });

    const teamCountResult = await executeSupabaseQuery(async () => {
      const { count } = await supabase
        .from("teams")
        .select("*", { count: "exact", head: true })
        .eq("party_id", partyId);
      return { data: count, error: null };
    });

    // 남은 시간 계산
    let timeRemaining = null;
    let progress = 0;
    if (party.start_at && party.end_at) {
      const now = new Date();
      const start = new Date(party.start_at);
      const end = new Date(party.end_at);
      const total = end.getTime() - start.getTime();
      const remaining = end.getTime() - now.getTime();

      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        timeRemaining = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        progress = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
      } else {
        timeRemaining = "00:00:00";
        progress = 100;
      }
    }

    return successResponse({
      party: {
        id: party.id,
        name: party.name,
        status: party.status,
        participants: participantCountResult.success ? participantCountResult.data || 0 : 0,
        teams: teamCountResult.success ? teamCountResult.data || 0 : 0,
        timeRemaining,
        progress,
      },
      personal: personalRankings, // 전체 개인 랭킹 (Crux + Grip 합쳐서)
      crux: cruxRankings, // Crux 그룹 랭킹
      grip: gripRankings, // Grip 그룹 랭킹
      team: teamRankings,
      challenge: challengeRankings,
    });
  } catch (error) {
    console.error("랭킹 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
