"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../components/Header";
import { RankboardFooterNavigation } from "../components/RankboardFooterNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Trophy, Clock } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";

type TabType = "group" | "team" | "challenge";
type SubTabType = "crux" | "grip";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>("group");
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("crux");

  // Mock data
  const partyInfo = {
    name: "볼더링 파티 #2025",
    status: "진행중",
    participants: 24,
    teams: 10,
    timeRemaining: "01:05:12",
    progress: 65,
  };

  const cruxRankings = [
    { rank: 1, name: "김클라임", teamNumber: 2, level: "White", score: 28 },
    { rank: 2, name: "이클라임", teamNumber: 1, level: "Hite", score: 26 },
    { rank: 3, name: "박클라임", teamNumber: 3, level: "White", score: 25 },
    { rank: 4, name: "최클라임", teamNumber: 2, level: "Hite", score: 24 },
    { rank: 5, name: "정클라임", teamNumber: 1, level: "White", score: 23 },
    { rank: 6, name: "강클라임", teamNumber: 4, level: "Hite", score: 22 },
  ];

  const gripRankings = [
    { rank: 1, name: "홍클라임", teamNumber: 1, level: "Purple", score: 28 },
    { rank: 2, name: "윤클라임", teamNumber: 1, level: "Navy", score: 26 },
    { rank: 3, name: "조클라임", teamNumber: 2, level: "Purple", score: 25 },
    { rank: 4, name: "신클라임", teamNumber: 1, level: "Blue", score: 24 },
    { rank: 5, name: "오클라임", teamNumber: 2, level: "Navy", score: 23 },
    { rank: 6, name: "서클라임", teamNumber: 3, level: "Purple", score: 22 },
  ];

  const teamRankings = [
    { rank: 1, team: "3조", blocks: 4, score: 1247, icon: Trophy },
    { rank: 2, team: "2조", blocks: 4, score: 1247, icon: Clock },
    { rank: 3, team: "7조", blocks: 4, score: 1247, icon: Clock },
    { rank: 4, team: "1조", blocks: 4, score: 1247, icon: null },
  ];

  const challengeStatus = [
    { rank: 1, team: "3조", attempts: 1, failures: 1, time: "3분 28초", icon: Trophy },
    { rank: 2, team: "2조", attempts: 1, failures: 1, time: "3분 28초", icon: Clock },
    { rank: 3, team: "7조", attempts: 1, failures: 1, time: "3분 28초", icon: Clock },
    { rank: 4, team: "1조", attempts: 1, failures: 1, time: "3분 28초", icon: null },
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-500" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-orange-500" />;
    return <span className="text-sm text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        variant="dashboard"
        partyName={partyInfo.name}
        userName={session?.user?.name || "김클라임"}
        team="1"
        level="Purple"
      />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 space-y-4 pb-24">
        {/* Party Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>파티 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="font-semibold">{partyInfo.status}</span>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">참가자</span>
                <p className="font-semibold">{partyInfo.participants}명</p>
              </div>
              <div>
                <span className="text-muted-foreground">팀</span>
                <p className="font-semibold">{partyInfo.teams}개</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">남은 시간</span>
                <span className="font-semibold">{partyInfo.timeRemaining}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${partyInfo.progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("group")}
            className={cn(
              "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "group"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            그룹별 랭킹
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={cn(
              "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "team"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            팀 랭킹
          </button>
          <button
            onClick={() => setActiveTab("challenge")}
            className={cn(
              "flex-1 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "challenge"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            챌린지 현황
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === "group" && (
            <>
              {/* Sub Navigation for Group Ranking */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveSubTab("crux")}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    activeSubTab === "crux"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  Crux
                </button>
                <button
                  onClick={() => setActiveSubTab("grip")}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    activeSubTab === "grip"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  Grip
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-400 text-right">Hunted Point</p>
                <div className="space-y-2">
                  {(activeSubTab === "crux" ? cruxRankings : gripRankings).map((item) => (
                    <Card key={item.rank} className="p-4">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                            <div className="flex-1">
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.teamNumber}조 {item.level}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">{item.score} 점</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "team" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-right">Total score</p>
              <div className="space-y-2">
                {teamRankings.map((item) => (
                  <Card key={item.rank} className="p-4">
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                          <div className="flex-1">
                            <p className="font-semibold">{item.team}</p>
                            <p className="text-xs text-muted-foreground">
                              현재 모인 블럭 갯수: {item.blocks}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{item.score} 점</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === "challenge" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-right">Taken Time</p>
              <div className="space-y-2">
                {challengeStatus.map((item) => (
                  <Card key={item.rank} className="p-4">
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                          <div className="flex-1">
                            <p className="font-semibold">{item.team}</p>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>도전 가능 횟수: {item.attempts}</p>
                              <p>실패 횟수: {item.failures}</p>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{item.time}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <RankboardFooterNavigation />
    </div>
  );
}
