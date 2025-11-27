"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import { RankboardFooterNavigation } from "../../components/RankboardFooterNavigation";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Trophy } from "lucide-react";
import { cn } from "@pkg/ui-web/lib/utils";
import { PARTY_STATUS_LABELS, PARTY_STATUS_COLORS, type PartyStatus } from "@pkg/shared";
import type { Party } from "@pkg/shared";
import { createClient } from "@pkg/supabase/client";
import { TeamRanking } from "../../components/Tetris/TeamRanking";
import { useCountdownTimer } from "../../hooks/useCountdownTimer";

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
  const [userGroup, setUserGroup] = useState<SubTabType | null>(null);
  const [rankingData, setRankingData] = useState<{
    party: {
      id: string;
      name: string;
      status: string;
      participants: number;
      teams: number;
    };
    partyStartAt?: string | null;
    partyEndAt?: string | null;
    crux?: Array<{
      rank: number;
      userId: string;
      nickname: string;
      teamId: string | null;
      teamName: string | null;
      totalScore: number;
    }>;
    grip?: Array<{
      rank: number;
      userId: string;
      nickname: string;
      teamId: string | null;
      teamName: string | null;
      totalScore: number;
    }>;
    team: Array<{
      rank: number;
      teamId?: string;
      teamName?: string;
      totalScore: number;
      usedPieces: number;
      totalPieces: number;
      completedLines: number;
      members?: Array<{ name: string; level: string }>;
    }>;
    challenge: Array<{
      rank?: number;
      teamId?: string;
      teamName?: string;
      attempts?: number;
      failures?: number;
      time?: string;
    }>;
  } | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);

  // 랭킹 데이터 조회 함수 (Realtime에서도 사용)
  const fetchRankingData = useCallback(async () => {
    if (!partyId) return;

    try {
      setLoading(true);

      // 사용자 그룹 조회
      const memberResponse = await fetch(`/api/party/${partyId}/member`);
      if (memberResponse.ok) {
        const memberResult = await memberResponse.json();
        if (memberResult.success && memberResult.data) {
          const level = memberResult.data.level;
          // Crux 그룹: White, Hite
          // Grip 그룹: Blue, Navy, Purple
          if (level === "White" || level === "Hite") {
            setUserGroup("crux");
            setActiveSubTab("crux");
          } else if (["Blue", "Navy", "Purple"].includes(level)) {
            setUserGroup("grip");
            setActiveSubTab("grip");
          }
          setCurrentTeamId(memberResult.data.team_id || null);
        }
      }

      // 랭킹 데이터 조회
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
            start_at: result.data.partyStartAt || null,
            end_at: result.data.partyEndAt || null,
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
  }, [partyId]);

  // 사용자 그룹 조회 및 랭킹 데이터 조회
  useEffect(() => {
    if (!partyId) return;

    // 초기 데이터 로드
    fetchRankingData();

    // Supabase Realtime 구독
    const supabase = createClient();
    if (!supabase) {
      console.error("Supabase 클라이언트 생성 실패");
      return;
    }

    // 1. level_scores 테이블 변경 감지 (INSERT, UPDATE, DELETE)
    const scoresChannel = supabase
      .channel(`level_scores_changes_${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE 모두 감지
          schema: "public",
          table: "level_scores",
          filter: `party_id=eq.${partyId}`, // 해당 파티의 변경만 감지
        },
        (payload) => {
          console.log("📡 level_scores 변경 감지:", payload);
          // 랭킹 데이터 다시 조회 (로딩 상태 없이)
          setLoading(false); // 로딩 상태는 유지하지 않음
          fetchRankingData();
        },
      )
      .subscribe();

    // 2. 파티 상태 변경 감지
    const partyChannel = supabase
      .channel(`party_status_${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "parties",
          filter: `id=eq.${partyId}`,
        },
        (payload) => {
          console.log("📡 파티 상태 변경 감지:", payload);
          const updatedParty = payload.new as Party;
          if (updatedParty) {
            setParty(updatedParty);
            // 랭킹 데이터도 다시 조회하여 파티 정보 업데이트
            fetchRankingData();
          }
        },
      )
      .subscribe();

    // cleanup: 컴포넌트 언마운트 시 구독 해제
    return () => {
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(partyChannel);
    };
  }, [partyId, fetchRankingData]);

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

  // Hooks must be called before any conditional returns
  const sessionUserId = (session?.user as { id?: string | null })?.id || null;
  const { time: countdownTime, progress: countdownProgress } = useCountdownTimer(
    rankingData?.partyEndAt ?? party?.end_at ?? null,
    {
      startTime: rankingData?.partyStartAt ?? party?.start_at ?? null,
    },
  );

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
  const cruxRankings = rankingData.crux || [];
  const gripRankings = rankingData.grip || [];
  const currentGroupRankings = activeSubTab === "crux" ? cruxRankings : gripRankings;
  const teamRankings = rankingData.team || [];
  const challengeRankings = rankingData.challenge || [];
  const challengeList =
    challengeRankings.length > 0
      ? challengeRankings
      : teamRankings.map((team) => ({
          rank: team.rank,
          teamId: team.teamId,
          teamName: team.teamName || `${team.teamNumber}조`,
          attempts: 0,
          failures: 0,
          time: "--:--",
        }));
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
            {rankingData.partyEndAt && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">남은 시간</span>
                  <span className="font-semibold">{countdownTime}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${countdownProgress}%`,
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
                  {currentGroupRankings.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {activeSubTab === "crux" ? "Crux" : "Grip"} 그룹 랭킹 데이터가 없습니다.
                    </div>
                  ) : (
                    currentGroupRankings.map((item) => (
                      <Card
                        key={item.userId}
                        className={cn(
                          "p-4 border transition-all",
                          sessionUserId === item.userId ? "border-primary" : "",
                        )}
                      >
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
            <Card>
              <CardContent className="pt-6">
                {teamRankings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    팀 랭킹 데이터가 없습니다.
                  </div>
                ) : (
                  <TeamRanking teams={teamRankings} highlightTeamId={currentTeamId} />
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "challenge" && (
            <div className="space-y-4">
              <p className="text-gray-400 text-right">Taken Time</p>
              <div className="space-y-2">
                {challengeList.map((item, index) => (
                  <Card
                    key={`${item.teamId || index}-${index}`}
                    className={cn(
                      "p-4 border transition-all",
                      currentTeamId && item.teamId === currentTeamId ? "border-primary" : "",
                    )}
                  >
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-6 flex justify-center">
                            {getRankIcon(item.rank || index + 1)}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{item.teamName || "팀 정보 없음"}</p>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>도전 가능 횟수: {item.attempts ?? 0}</p>
                              <p>실패 횟수: {item.failures ?? 0}</p>
                            </div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{item.time || "--:--"}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <RankboardFooterNavigation partyId={partyId} />
    </div>
  );
}
