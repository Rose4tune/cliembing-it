"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Trophy, Users, Target } from "lucide-react";

type PersonalRanking = {
  rank: number;
  user: {
    id: string;
    nickname: string;
  };
  totalScore: number;
};

type TeamRanking = {
  rank: number;
  teamId: string;
  teamName: string;
  totalScore: number;
};

type ChallengeRanking = {
  rank: number;
  teamId: string;
  teamName: string;
  time: string;
};

export default function RankingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [cruxRankings, setCruxRankings] = useState<PersonalRanking[]>([]);
  const [gripRankings, setGripRankings] = useState<PersonalRanking[]>([]);
  const [teamRankings, setTeamRankings] = useState<TeamRanking[]>([]);
  const [challengeRankings, setChallengeRankings] = useState<ChallengeRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"crux" | "grip" | "team" | "challenge">("crux");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchRankings();
    }
  }, [status, partyId, router]);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/${partyId}/rankings`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "랭킹을 불러올 수 없습니다");
      }

      setCruxRankings(result.data.crux || []);
      setGripRankings(result.data.grip || []);
      setTeamRankings(result.data.team || []);
      setChallengeRankings(result.data.challenge || []);
    } catch (err) {
      console.error("랭킹 조회 에러:", err);
      setError(err instanceof Error ? err.message : "랭킹을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center ml-20">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!session || !partyId) {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col ml-20">
        <Header variant="login" title="전체 랭킹" />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">{error}</div>
              <button
                onClick={() => router.push("/")}
                className="w-full mt-4 px-4 py-2 bg-secondary rounded-md"
              >
                홈으로 돌아가기
              </button>
            </CardContent>
          </Card>
        </main>
        <AdminSidebar />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col ml-20">
      <Header variant="login" title="전체 랭킹" />

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 space-y-6 pb-6">
        {/* 탭 */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("crux")}
            className={`px-4 py-2 font-medium ${
              activeTab === "crux"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Trophy className="h-4 w-4 inline mr-2" />
            Crux 랭킹
          </button>
          <button
            onClick={() => setActiveTab("grip")}
            className={`px-4 py-2 font-medium ${
              activeTab === "grip"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Trophy className="h-4 w-4 inline mr-2" />
            Grip 랭킹
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`px-4 py-2 font-medium ${
              activeTab === "team"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />팀 랭킹
          </button>
          <button
            onClick={() => setActiveTab("challenge")}
            className={`px-4 py-2 font-medium ${
              activeTab === "challenge"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Target className="h-4 w-4 inline mr-2" />
            챌린지 랭킹
          </button>
        </div>

        {/* Crux 랭킹 */}
        {activeTab === "crux" && (
          <Card>
            <CardHeader>
              <CardTitle>Crux 랭킹</CardTitle>
            </CardHeader>
            <CardContent>
              {cruxRankings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Crux 그룹 랭킹 데이터가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {cruxRankings.map((ranking) => (
                    <div
                      key={ranking.user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            ranking.rank === 1
                              ? "bg-yellow-500 text-white"
                              : ranking.rank === 2
                                ? "bg-gray-400 text-white"
                                : ranking.rank === 3
                                  ? "bg-orange-600 text-white"
                                  : "bg-muted"
                          }`}
                        >
                          {ranking.rank}
                        </div>
                        <div>
                          <div className="font-semibold">{ranking.user.nickname}</div>
                        </div>
                      </div>
                      <div className="text-lg font-bold">{ranking.totalScore}점</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Grip 랭킹 */}
        {activeTab === "grip" && (
          <Card>
            <CardHeader>
              <CardTitle>Grip 랭킹</CardTitle>
            </CardHeader>
            <CardContent>
              {gripRankings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Grip 그룹 랭킹 데이터가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {gripRankings.map((ranking) => (
                    <div
                      key={ranking.user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            ranking.rank === 1
                              ? "bg-yellow-500 text-white"
                              : ranking.rank === 2
                                ? "bg-gray-400 text-white"
                                : ranking.rank === 3
                                  ? "bg-orange-600 text-white"
                                  : "bg-muted"
                          }`}
                        >
                          {ranking.rank}
                        </div>
                        <div>
                          <div className="font-semibold">{ranking.user.nickname}</div>
                        </div>
                      </div>
                      <div className="text-lg font-bold">{ranking.totalScore}점</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 팀 랭킹 */}
        {activeTab === "team" && (
          <Card>
            <CardHeader>
              <CardTitle>팀 랭킹</CardTitle>
            </CardHeader>
            <CardContent>
              {teamRankings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  팀 랭킹 데이터가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {teamRankings.map((ranking) => (
                    <div
                      key={ranking.teamId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            ranking.rank === 1
                              ? "bg-yellow-500 text-white"
                              : ranking.rank === 2
                                ? "bg-gray-400 text-white"
                                : ranking.rank === 3
                                  ? "bg-orange-600 text-white"
                                  : "bg-muted"
                          }`}
                        >
                          {ranking.rank}
                        </div>
                        <div className="font-semibold">{ranking.teamName}</div>
                      </div>
                      <div className="text-lg font-bold">{ranking.totalScore}점</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 챌린지 랭킹 */}
        {activeTab === "challenge" && (
          <Card>
            <CardHeader>
              <CardTitle>챌린지 랭킹</CardTitle>
            </CardHeader>
            <CardContent>
              {challengeRankings.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  챌린지 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {challengeRankings.map((ranking) => (
                    <div
                      key={ranking.teamId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            ranking.rank === 1
                              ? "bg-yellow-500 text-white"
                              : ranking.rank === 2
                                ? "bg-gray-400 text-white"
                                : ranking.rank === 3
                                  ? "bg-orange-600 text-white"
                                  : "bg-muted"
                          }`}
                        >
                          {ranking.rank}
                        </div>
                        <div className="font-semibold">{ranking.teamName}</div>
                      </div>
                      <div className="text-lg font-bold">{ranking.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <AdminSidebar />
    </div>
  );
}
