import { NextResponse } from "next/server";
import { getServerSession, authOptions, userService } from "@pkg/auth";

/**
 * 회원 탈퇴 API
 * DELETE /api/auth/delete-account
 */
export async function DELETE(): Promise<Response> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "인증되지 않은 사용자입니다" }, { status: 401 });
    }

    const userId = (session.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: "사용자 ID를 찾을 수 없습니다" }, { status: 400 });
    }

    // Supabase에서 사용자 삭제
    const success = await userService.deleteUser(userId);

    if (!success) {
      return NextResponse.json({ error: "회원 탈퇴에 실패했습니다" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("회원 탈퇴 에러:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
