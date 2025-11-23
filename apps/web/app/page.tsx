"use client";

import { useSession } from "next-auth/react";
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

type PartyStatus = "none" | "waiting" | "active";

export default function Home() {
  const { data: session, status } = useSession();

  const partyStatus: PartyStatus = session ? "none" : "none";

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
          ) : partyStatus === "none" ? (
            <>
              <CreatePartyCard />
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
        </div>
      </main>

      <FooterNavigation />
    </div>
  );
}
