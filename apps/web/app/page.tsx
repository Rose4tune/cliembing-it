"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { FooterNavigation } from "./components/FooterNavigation";
import { HeroSection } from "./components/HeroSection";
import { LoginRequiredCard } from "./components/PartyCards/LoginRequiredCard";
import { JoinPartyCard } from "./components/PartyCards/JoinPartyCard";
import { CreatePartyCard } from "./components/PartyCards/CreatePartyCard";
import { WaitingPartyCard } from "./components/PartyCards/WaitingPartyCard";
import { ActivePartyCard } from "./components/PartyCards/ActivePartyCard";
import { FeatureCards } from "./components/PartyCards/FeatureCards";
import { GamePreviewCard } from "./components/PartyCards/GamePreviewCard";
import { ParticipatedPartiesCard } from "./components/PartyCards/ParticipatedPartiesCard";
import { useViewMode } from "./contexts/ViewModeContext";

type PartyStatus = "none" | "waiting" | "active";

export default function Home() {
  const { data: session, status } = useSession();
  const { isAdminView } = useViewMode();
  const [canCreateParty, setCanCreateParty] = useState(false);

  const partyStatus: PartyStatus = session ? "none" : "none";

  // 권한 확인 (파티 생성 가능 여부)
  useEffect(() => {
    if (!session) return;

    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/user/permissions");
        const result = await response.json();
        if (result.success) {
          setCanCreateParty(result.data.canCreateParty || false);
        }
      } catch (error) {
        console.error("권한 조회 실패:", error);
      }
    };

    fetchPermissions();
  }, [session]);

  const handleJoinParty = (name: string) => {
    console.log("Joining party with name:", name);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-8 pb-24">
        <HeroSection />

        <div className="space-y-6">
          {status === "loading" ? (
            <div className="text-center text-muted-foreground">로딩 중...</div>
          ) : !session ? (
            <LoginRequiredCard />
          ) : (
            <>
              {/* 참여한 파티 목록 */}
              <ParticipatedPartiesCard />

              {partyStatus === "none" ? (
                <>
                  {/* 파티 생성 카드는 관리자 모드일 때만 표시 */}
                  {isAdminView && canCreateParty && <CreatePartyCard />}
                  <JoinPartyCard onJoin={handleJoinParty} />
                </>
              ) : partyStatus === "waiting" ? (
                <WaitingPartyCard />
              ) : (
                <>
                  <ActivePartyCard />
                  <FeatureCards />
                </>
              )}

              <GamePreviewCard />
            </>
          )}
        </div>
      </main>

      <FooterNavigation />
    </div>
  );
}
