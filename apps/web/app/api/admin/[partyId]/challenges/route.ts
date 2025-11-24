import { NextResponse } from "next/server";
import { getServerSession, authOptions } from "@pkg/auth";
import { createAdminClient } from "@pkg/supabase/server";
import { successResponse, errorResponse, executeSupabaseQuery } from "@pkg/supabase/api-helpers";

/**
 * 챌린지 기록 조회 API (관리자용)
 * GET /api/admin/[partyId]/challenges
 */
export async function GET(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const { partyId } = await params;
    const supabase = createAdminClient();

    // TODO: challenge_records 테이블이 생성되면 해당 테이블 조회
    // 현재는 임시로 빈 배열 반환
    const challengeRecords: any[] = [];

    return successResponse(challengeRecords);
  } catch (error) {
    console.error("챌린지 기록 조회 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}

/**
 * 챌린지 기록 생성 API (관리자용)
 * POST /api/admin/[partyId]/challenges
 */
export async function POST(request: Request, { params }: { params: Promise<{ partyId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return errorResponse("인증이 필요합니다", 401);
    }

    const userRole = (session.user as { role?: string | null })?.role;
    if (userRole !== "admin") {
      return errorResponse("관리자 권한이 필요합니다", 403);
    }

    const { partyId } = await params;
    const body = await request.json();
    const { teamNumber, time, challengeType } = body;

    if (!teamNumber || !time) {
      return errorResponse("팀 번호와 시간이 필요합니다", 400);
    }

    // TODO: challenge_records 테이블이 생성되면 해당 테이블에 저장
    // 현재는 임시로 성공 응답만 반환
    return successResponse({
      teamNumber,
      time,
      challengeType,
      message: "챌린지 기록이 저장되었습니다",
    });
  } catch (error) {
    console.error("챌린지 기록 생성 에러:", error);
    return errorResponse(error instanceof Error ? error.message : "서버 오류가 발생했습니다", 500);
  }
}
