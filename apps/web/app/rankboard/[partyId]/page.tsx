"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { RankboardFooterNavigation } from "../../components/RankboardFooterNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Trophy } from "lucide-react";
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
  const [rankingData, setRankingData] = useState<{
    party: {
      id: string;
      name: string;
      status: string;
      participants: number;
      teams: number;
      timeRemaining: string | null;
      progress: number;
    };
    personal: Array<{
      rank: number;
      userId: string;
      nickname: string;
      teamId: string | null;
      teamName: string | null;
      totalScore: number;
    }>;
    team: Array<{
      rank: number;
      teamId: string;
      teamName: string;
      totalScore: number;
    }>;
    challenge: Array<{
      rank?: number;
      teamName?: string;
      attempts?: number;
      failures?: number;
      time?: string;
    }>;
  } | null>(null);

  // 랭킹 데이터 조회
  useEffect(() => {
    if (!partyId) return;

    const fetchRankings = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/party/${partyId}/rankings`);
        const result = await response.json();

        if (response.ok && result.success) {
          setRankingData(result.data);
          // 파티 정보도 랭킹 API에서 가져온 데이터로 설정
          if (result.data.party) {
            setParty({
              id: result.data.party.id,
              name: result.data.party.name,
              status: result.data.party.status as PartyStatus,
              total_participants: result.data.party.participants,
              total_teams: result.data.party.teams,
              start_at: null,
              end_at: null,
            } as Party);
          }
        } else {
          setError(result.error || "랭킹 정보를 불러올 수 없습니다");
        }
      } catch (error) {
        console.error("랭킹 조회 에러:", error);
        setError("랭킹 정보를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
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

        // 진행중인 파티는 시간 체크 없이 접근 가능
        if (party.status === "running") {
          return; // 접근 허용
        }

        // 진행중이 아닌 파티는 1시간 전 체크
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

  if (!rankingData) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header variant="dashboard" partyName="로딩 중..." />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
          <div className="text-center text-muted-foreground">로딩 중...</div>
        </main>
      </div>
    );
  }

  const statusColor =
    PARTY_STATUS_COLORS[party?.status as PartyStatus] || "bg-gray-100 text-gray-800";
  const statusLabel = PARTY_STATUS_LABELS[party?.status as PartyStatus] || party?.status;

  // 랭킹 데이터
  const personalRankings = rankingData.personal || [];
  const teamRankings = rankingData.team || [];
  const challengeRankings = rankingData.challenge || [];
  const partyInfo = rankingData.party;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        variant="dashboard"
        partyName={party.name}
        userName={
          session?.user?.name ||
          (session?.user as { nickname?: string | null })?.nickname ||
          "사용자"
        }
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
                <p className="font-semibold">{partyInfo.participants}명</p>
              </div>
              <div>
                <span className="text-muted-foreground">팀</span>
                <p className="font-semibold">{partyInfo.teams}개</p>
              </div>
            </div>
            {partyInfo.timeRemaining && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">남은 시간</span>
                  <span className="font-semibold">{partyInfo.timeRemaining}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${partyInfo.progress}%`,
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
                  {personalRankings.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      랭킹 데이터가 없습니다.
                    </div>
                  ) : (
                    personalRankings.map((item) => (
                      <Card key={item.userId} className="p-4">
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-6 flex justify-center">
                                {getRankIcon(item.rank)}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold">{item.nickname}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.teamName || "팀 없음"}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold">{item.totalScore} 점</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "team" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-right">Total score</p>
              <div className="space-y-2">
                {teamRankings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    팀 랭킹 데이터가 없습니다.
                  </div>
                ) : (
                  teamRankings.map((item) => (
                    <Card key={item.teamId} className="p-4">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                            <div className="flex-1">
                              <p className="font-semibold">{item.teamName}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">{item.totalScore} 점</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "challenge" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-right">Taken Time</p>
              <div className="space-y-2">
                {challengeRankings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    챌린지 데이터가 없습니다.
                  </div>
                ) : (
                  challengeRankings.map((item, index) => (
                    <Card key={index} className="p-4">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-6 flex justify-center">
                              {getRankIcon(item.rank || index + 1)}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{item.teamName || "팀 정보 없음"}</p>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {item.attempts !== undefined && (
                                  <p>도전 가능 횟수: {item.attempts}</p>
                                )}
                                {item.failures !== undefined && <p>실패 횟수: {item.failures}</p>}
                              </div>
                            </div>
                          </div>
                          {item.time && <span className="text-sm font-semibold">{item.time}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <RankboardFooterNavigation partyId={partyId} />
    </div>
  );
}
