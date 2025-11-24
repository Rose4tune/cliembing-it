"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { CheckCircle, XCircle, Clock, GamepadIcon } from "lucide-react";

type ScoreApproval = {
  id: string;
  user_id: string;
  level: string;
  problem_count: number;
  score: number;
  created_at: string;
  users: {
    id: string;
    nickname: string;
    email: string | null;
  };
};

type GameRequest = {
  id: string;
  team_number: number;
  status: string;
  requested_at: string;
};

export default function ApprovalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [scores, setScores] = useState<ScoreApproval[]>([]);
  const [approvedScores, setApprovedScores] = useState<ScoreApproval[]>([]);
  const [gameRequests, setGameRequests] = useState<GameRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchApprovals();
    }
  }, [status, partyId, router]);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/${partyId}/approvals`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "승인 대기 목록을 불러올 수 없습니다");
      }

      setScores(result.data.scores || []);
      setApprovedScores(result.data.approvedScores || []);
      setGameRequests(result.data.gameRequests || []);
    } catch (err) {
      console.error("승인 대기 목록 조회 에러:", err);
      setError(err instanceof Error ? err.message : "승인 대기 목록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveScore = async (scoreId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/admin/${partyId}/approvals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoreId,
          approved,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "승인 상태를 업데이트할 수 없습니다");
      }

      fetchApprovals();
      alert(approved ? "점수가 승인되었습니다." : "점수가 거부되었습니다.");
    } catch (err) {
      console.error("승인 상태 업데이트 에러:", err);
      alert(err instanceof Error ? err.message : "승인 상태 업데이트에 실패했습니다");
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
        <Header variant="login" title="승인 관리" />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-8 space-y-6 pb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-red-600">{error}</div>
              <Button onClick={() => router.push("/")} variant="secondary" className="w-full mt-4">
                홈으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </main>
        <AdminSidebar />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col ml-20">
      <Header variant="login" title="승인 관리" />

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 space-y-6 pb-6">
        {/* 점수 승인 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              점수 승인 대기
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scores.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                승인 대기 중인 점수가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {scores.map((score) => (
                  <Card key={score.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">{score.users.nickname}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          레벨: {score.level} | 문제 수: {score.problem_count} | 점수: {score.score}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(score.created_at).toLocaleString("ko-KR")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApproveScore(score.id, true)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          승인
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleApproveScore(score.id, false)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          거부
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 승인 완료된 점수 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              승인 완료된 점수
            </CardTitle>
          </CardHeader>
          <CardContent>
            {approvedScores.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                승인 완료된 점수가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {approvedScores.map((score) => (
                  <Card key={score.id} className="p-4 bg-green-50 dark:bg-green-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold flex items-center gap-2">
                          {score.users.nickname}
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          레벨: {score.level} | 문제 수: {score.problem_count} | 점수: {score.score}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          승인 시간:{" "}
                          {new Date(score.updated_at || score.created_at).toLocaleString("ko-KR")}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 게임 요청 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GamepadIcon className="h-5 w-5" />
              게임 요청 관리
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gameRequests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                대기 중인 게임 요청이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {gameRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold">{request.team_number}조</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          상태: {request.status}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(request.requested_at).toLocaleString("ko-KR")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          승인
                        </Button>
                        <Button variant="destructive" size="sm">
                          <XCircle className="h-4 w-4 mr-1" />
                          거부
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AdminSidebar />
    </div>
  );
}
