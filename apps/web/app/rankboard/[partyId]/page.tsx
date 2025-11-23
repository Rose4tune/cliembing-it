"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "../../../components/Header";
import { RankboardFooterNavigation } from "../../../components/RankboardFooterNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Trophy, Clock } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";
import { PARTY_STATUS_LABELS, PARTY_STATUS_COLORS, type PartyStatus } from "@pkg/shared";
import type { Party } from "@pkg/shared";

type TabType = "group" | "team" | "challenge";
type SubTabType = "crux" | "grip";

export default function RankboardPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const partyId = params?.partyId as string;

  const [activeTab, setActiveTab] = useState<TabType>("group");
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("crux");
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 파티 정보 조회
  useEffect(() => {
    if (!partyId) return;

    const fetchParty = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/party/${partyId}`);
        const result = await response.json();

        if (response.ok && result.success) {
          // API 응답 형식: successResponse(result.data)이므로 result.data가 파티 정보
          setParty(result.data);
        } else {
          setError(result.error || "파티를 찾을 수 없습니다");
        }
      } catch (error) {
        console.error("파티 조회 에러:", error);
        setError("파티 정보를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchParty();
  }, [partyId]);

  // 일반 사용자의 접근 제한 체크 (진행중이 아니거나 1시간 전이 아닌 경우)
  useEffect(() => {
    if (!party || !partyId) return;

    const checkAccess = async () => {
      try {
        // 관리자 권한 확인
        const response = await fetch(`/api/party/${partyId}/permissions`);
        const result = await response.json();

        // 관리자는 항상 접근 가능
        if (result.success && result.data.isAdmin) {
          return;
        }

        // 진행중이 아닌 파티는 접근 불가
        if (party.status !== "running") {
          alert("파티 시작 1시간 전부터 랭킹보드에 입장할 수 있습니다");
          router.push("/");
          return;
        }

        // 진행중인 파티도 1시간 전 체크
        if (!party.start_at) {
          alert("파티 시작 시간이 설정되지 않았습니다");
          router.push("/");
          return;
        }

        const startTime = new Date(party.start_at).getTime();
        const now = Date.now();
        const oneHourBefore = startTime - 60 * 60 * 1000; // 1시간 전

        // 아직 1시간 전이 아니면 접근 불가
        if (now < oneHourBefore) {
          alert("파티 시작 1시간 전부터 랭킹보드에 입장할 수 있습니다");
          router.push("/");
        }
      } catch (error) {
        console.error("접근 권한 확인 실패:", error);
        // 에러 시에도 안내 메시지
        alert("파티 시작 1시간 전부터 랭킹보드에 입장할 수 있습니다");
        router.push("/");
      }
    };

    checkAccess();
  }, [party, partyId, router]);

  // Mock data (실제 데이터로 교체 필요)
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header variant="dashboard" partyName="로딩 중..." />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
          <div className="text-center text-muted-foreground">로딩 중...</div>
        </main>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header variant="dashboard" partyName="오류" />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">{error || "파티를 찾을 수 없습니다"}</div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusColor =
    PARTY_STATUS_COLORS[party.status as PartyStatus] || "bg-gray-100 text-gray-800";
  const statusLabel = PARTY_STATUS_LABELS[party.status as PartyStatus] || party.status;

  // 진행 시간 계산 (임시)
  const timeRemaining = party.end_at
    ? Math.max(0, Math.floor((new Date(party.end_at).getTime() - Date.now()) / 1000))
    : 0;
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;
  const timeRemainingStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        variant="dashboard"
        partyName={party.name}
        userName={session?.user?.name || session?.user?.nickname || "사용자"}
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
              <div
                className={`w-3 h-3 rounded-full ${
                  party.status === "running" ? "bg-green-500" : "bg-gray-400"
                }`}
              ></div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">참가자</span>
                <p className="font-semibold">{party.total_participants || 0}명</p>
              </div>
              <div>
                <span className="text-muted-foreground">팀</span>
                <p className="font-semibold">{party.total_teams || 0}개</p>
              </div>
            </div>
            {party.end_at && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">남은 시간</span>
                  <span className="font-semibold">{timeRemainingStr}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (timeRemaining / 3600) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
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
