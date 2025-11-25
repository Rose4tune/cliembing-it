"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "../../../components/Header";
import { RankboardFooterNavigation } from "../../../components/RankboardFooterNavigation";

/**
 * 테트리스 게임 리다이렉트 페이지
 * teamId 없이 접근한 경우 사용자의 팀 ID로 리다이렉트
 */
export default function TetrisRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const partyId = params?.partyId as string;

  useEffect(() => {
    if (!partyId) return;

    const redirectToTeamGame = async () => {
      try {
        // 사용자 팀 ID 조회
        const memberResponse = await fetch(`/api/party/${partyId}/member`);
        const memberResult = await memberResponse.json();
        if (memberResponse.ok && memberResult.success && memberResult.data?.team_id) {
          // 팀 ID로 리다이렉트
          router.replace(`/rankboard/${partyId}/tetris/${memberResult.data.team_id}`);
        } else {
          // 팀에 속하지 않은 경우 랭킹보드로 리다이렉트
          router.replace(`/rankboard/${partyId}`);
        }
      } catch (error) {
        console.error("리다이렉트 에러:", error);
        router.replace(`/rankboard/${partyId}`);
      }
    };

    redirectToTeamGame();
  }, [partyId, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header variant="dashboard" partyName="로딩 중..." />
      <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
        <div className="text-center text-muted-foreground">리다이렉트 중...</div>
      </main>
      <RankboardFooterNavigation partyId={partyId} />
    </div>
  );
}
