"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@pkg/ui-web";
import { Clock, Play, Pause, Square, CheckCircle, XCircle, Ban, AlertCircle } from "lucide-react";
import { formatTimer, formatDuration } from "../../../utils/time-format";

type Team = {
  id: string;
  name: string;
};

type ChallengeRecord = {
  id: string;
  teamId: string;
  teamName: string;
  attemptNumber: number;
  startedAt: string;
  endedAt: string;
  duration: string;
  status: "success" | "failed" | "invalidated";
  createdAt: string;
  updatedAt: string;
};

type TimerState = "idle" | "running" | "paused";

export default function ChallengesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [records, setRecords] = useState<ChallengeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partyStatus, setPartyStatus] = useState<string | null>(null);
  const [partyEndAt, setPartyEndAt] = useState<string | null>(null);

  // 타이머 상태
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 다이얼로그 상태
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<"complete" | "fail" | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchTeams();
      fetchRecords();
      fetchPartyInfo();
    }
  }, [status, partyId, router]);

  // 타이머 업데이트
  useEffect(() => {
    if (timerState === "running" && startTime) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        setElapsedTime(now - startTime + pausedTime);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState, startTime, pausedTime]);

  // 파티 종료 감지
  useEffect(() => {
    if (!partyEndAt) return;

    const checkPartyEnd = () => {
      const now = new Date().getTime();
      const end = new Date(partyEndAt).getTime();

      if (now >= end && timerState === "running") {
        // 파티 종료 시 진행 중인 타이머 자동 실패 처리
        handleAutoFail();
      }
    };

    const interval = setInterval(checkPartyEnd, 1000);
    return () => clearInterval(interval);
  }, [partyEndAt, timerState]);

  const fetchPartyInfo = async () => {
    try {
      const response = await fetch(`/api/party/${partyId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setPartyStatus(result.data.status);
        setPartyEndAt(result.data.end_at);
      }
    } catch (err) {
      console.error("파티 정보 조회 에러:", err);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await fetch(`/api/admin/${partyId}/teams`);
      const result = await response.json();

      if (response.ok && result.success) {
        setTeams(result.data || []);
      }
    } catch (err) {
      console.error("팀 목록 조회 에러:", err);
    }
  };

  const fetchRecords = async () => {
    try {
      const response = await fetch(`/api/admin/${partyId}/challenges/records`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "챌린지 기록을 불러올 수 없습니다");
      }

      setRecords(result.data || []);
    } catch (err) {
      console.error("챌린지 기록 조회 에러:", err);
      setError(err instanceof Error ? err.message : "챌린지 기록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const getTeamAttemptCount = (teamId: string): number => {
    return records.filter((r) => r.teamId === teamId && r.status !== "invalidated").length;
  };

  const getNextAttemptNumber = (teamId: string): number => {
    const existingAttempts = records.filter(
      (r) => r.teamId === teamId && r.status !== "invalidated",
    );
    const maxAttempt = Math.max(...existingAttempts.map((r) => r.attemptNumber), 0);
    return maxAttempt + 1;
  };

  const canStartChallenge = (): boolean => {
    if (!selectedTeamId) return false;
    if (partyStatus === "finished") return false;
    if (partyEndAt && new Date(partyEndAt) < new Date()) return false;
    const attemptCount = getTeamAttemptCount(selectedTeamId);
    return attemptCount < 2;
  };

  const handleStartClick = () => {
    if (!selectedTeamId) {
      alert("팀을 선택해주세요.");
      return;
    }

    if (!canStartChallenge()) {
      alert("이 팀은 이미 2회 도전을 완료했거나 파티가 종료되었습니다.");
      return;
    }

    setShowStartDialog(true);
  };

  const handleStartConfirm = () => {
    setShowStartDialog(false);
    setStartTime(Date.now());
    setPausedTime(0);
    setElapsedTime(0);
    setTimerState("running");
  };

  const handlePause = () => {
    if (timerState === "running") {
      setPausedTime(elapsedTime);
      setTimerState("paused");
    }
  };

  const handleResume = () => {
    if (timerState === "paused") {
      setStartTime(Date.now());
      setTimerState("running");
    }
  };

  const handleCompleteClick = () => {
    // 종료 버튼을 누르면 즉시 타이머 멈춤
    if (timerState === "running") {
      setPausedTime(elapsedTime);
      setTimerState("paused");
    }
    setPendingAction("complete");
    setShowCompleteDialog(true);
  };

  const handleFailClick = () => {
    // 실패 버튼을 누르면 즉시 타이머 멈춤
    if (timerState === "running") {
      setPausedTime(elapsedTime);
      setTimerState("paused");
    }
    setPendingAction("fail");
    setShowFailDialog(true);
  };

  const handleAutoFail = async () => {
    if (!selectedTeamId || !startTime) return;

    const startedAt = new Date(startTime).toISOString();
    const endedAt = new Date().toISOString();
    const duration = formatDuration(elapsedTime);
    const attemptNumber = getNextAttemptNumber(selectedTeamId);

    try {
      const response = await fetch(`/api/admin/${partyId}/challenges/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          attemptNumber,
          startedAt,
          endedAt,
          duration,
          status: "failed",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "챌린지 기록 저장 실패");
      }

      resetTimer();
      fetchRecords();
    } catch (err) {
      console.error("챌린지 기록 저장 에러:", err);
      alert(err instanceof Error ? err.message : "챌린지 기록 저장에 실패했습니다");
    }
  };

  const handleCompleteConfirm = async () => {
    setShowCompleteDialog(false);

    if (!selectedTeamId || !startTime || pendingAction !== "complete") return;

    // 다이얼로그가 열려있는 동안 멈춘 시간 사용
    const finalElapsedTime = timerState === "paused" ? pausedTime : elapsedTime;
    const startedAt = new Date(startTime).toISOString();
    const endedAt = new Date(startTime + finalElapsedTime).toISOString();
    const duration = formatDuration(finalElapsedTime);
    const attemptNumber = getNextAttemptNumber(selectedTeamId);

    try {
      const response = await fetch(`/api/admin/${partyId}/challenges/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          attemptNumber,
          startedAt,
          endedAt,
          duration,
          status: "success",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "챌린지 기록 저장 실패");
      }

      resetTimer();
      fetchRecords();
      alert("챌린지 기록이 저장되었습니다.");
    } catch (err) {
      console.error("챌린지 기록 저장 에러:", err);
      alert(err instanceof Error ? err.message : "챌린지 기록 저장에 실패했습니다");
    } finally {
      setPendingAction(null);
    }
  };

  const handleFailConfirm = async () => {
    setShowFailDialog(false);

    if (!selectedTeamId || !startTime || pendingAction !== "fail") return;

    // 다이얼로그가 열려있는 동안 멈춘 시간 사용
    const finalElapsedTime = timerState === "paused" ? pausedTime : elapsedTime;
    const startedAt = new Date(startTime).toISOString();
    const endedAt = new Date(startTime + finalElapsedTime).toISOString();
    const duration = formatDuration(finalElapsedTime);
    const attemptNumber = getNextAttemptNumber(selectedTeamId);

    try {
      const response = await fetch(`/api/admin/${partyId}/challenges/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          attemptNumber,
          startedAt,
          endedAt,
          duration,
          status: "failed",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "챌린지 기록 저장 실패");
      }

      resetTimer();
      fetchRecords();
      alert("챌린지 실패 기록이 저장되었습니다.");
    } catch (err) {
      console.error("챌린지 기록 저장 에러:", err);
      alert(err instanceof Error ? err.message : "챌린지 기록 저장에 실패했습니다");
    } finally {
      setPendingAction(null);
    }
  };

  const resetTimer = () => {
    setTimerState("idle");
    setStartTime(null);
    setPausedTime(0);
    setElapsedTime(0);
  };

  const handleInvalidate = async (recordId: string) => {
    if (!confirm("이 기록을 무효화하시겠습니까? 무효화 후 해당 팀은 다시 도전할 수 있습니다.")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/${partyId}/challenges/records/${recordId}/invalidate`,
        {
          method: "PATCH",
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "기록 무효화 실패");
      }

      fetchRecords();
      alert("기록이 무효화되었습니다.");
    } catch (err) {
      console.error("기록 무효화 에러:", err);
      alert(err instanceof Error ? err.message : "기록 무효화에 실패했습니다");
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
        <Header variant="login" title="챌린지 기록" />
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

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const selectedTeamAttemptCount = selectedTeamId ? getTeamAttemptCount(selectedTeamId) : 0;
  const isPartyEnded = partyEndAt && new Date(partyEndAt) < new Date();

  return (
    <div className="flex min-h-screen flex-col ml-20">
      <Header variant="login" title="챌린지 기록" />

      <main className="flex-1 container max-w-md mx-auto px-4 py-8 pb-6">
        {/* 팀 선택 (상단) */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">팀 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => {
                const attemptCount = getTeamAttemptCount(team.id);
                const isSelected = selectedTeamId === team.id;
                const isDisabled = attemptCount >= 2 || isPartyEnded;

                return (
                  <Button
                    key={team.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => !isDisabled && setSelectedTeamId(team.id)}
                    disabled={isDisabled}
                    className={isSelected ? "border-2 border-primary" : ""}
                  >
                    {team.name}
                    {attemptCount > 0 && (
                      <span className="ml-1 text-xs opacity-70">({attemptCount}/2)</span>
                    )}
                  </Button>
                );
              })}
            </div>
            {selectedTeam && (
              <div className="mt-3 text-sm text-muted-foreground">
                선택된 팀: <span className="font-semibold">{selectedTeam.name}</span>
                {selectedTeamAttemptCount > 0 && (
                  <span className="ml-2">({selectedTeamAttemptCount}회차 완료)</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 타이머 (중앙) */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              <div className="text-7xl font-mono font-bold tracking-wider">
                {formatTimer(elapsedTime)}
              </div>
              {selectedTeam && timerState === "idle" && (
                <div className="text-sm text-muted-foreground">
                  도전 팀: <span className="font-semibold">{selectedTeam.name}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 게임 진행 버튼 (하단) */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="space-y-2">
              {timerState === "idle" ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStartClick}
                  disabled={!canStartChallenge()}
                  className="w-full"
                >
                  <Play className="h-5 w-5 mr-2" />
                  시작
                </Button>
              ) : (
                <>
                  {timerState === "running" ? (
                    <Button variant="outline" size="lg" onClick={handlePause} className="w-full">
                      <Pause className="h-5 w-5 mr-2" />
                      일시정지
                    </Button>
                  ) : (
                    <Button variant="outline" size="lg" onClick={handleResume} className="w-full">
                      <Play className="h-5 w-5 mr-2" />
                      재개
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="default"
                      size="lg"
                      onClick={handleCompleteClick}
                      className="w-full"
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      종료
                    </Button>
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={handleFailClick}
                      className="w-full"
                    >
                      <XCircle className="h-5 w-5 mr-2" />
                      실패
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 기록 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">챌린지 기록</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                저장된 챌린지 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      record.status === "invalidated" ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {record.teamName} - {record.attemptNumber}회차
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {record.status === "success" && (
                          <span className="text-green-600">성공</span>
                        )}
                        {record.status === "failed" && <span className="text-red-600">실패</span>}
                        {record.status === "invalidated" && (
                          <span className="text-gray-500">무효</span>
                        )}
                        <span className="ml-2">
                          {new Date(record.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-mono font-bold">{record.duration}</div>
                      {record.status !== "invalidated" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInvalidate(record.id)}
                          className="h-8 w-8 p-0"
                          title="무효화"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AdminSidebar />

      {/* 시작 확인 다이얼로그 */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>챌린지 시작 확인</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center">
              도전 팀: <span className="font-semibold">{selectedTeam?.name}</span>이 맞나요?
            </p>
            <p className="text-center mt-2 text-sm text-muted-foreground">
              시작을 누르면 시간을 측정하기 시작합니다.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={handleStartConfirm}>
              챌린지 기록!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 종료 확인 다이얼로그 */}
      <Dialog
        open={showCompleteDialog}
        onOpenChange={(open) => {
          setShowCompleteDialog(open);
          // 다이얼로그가 닫히고 타이머가 일시정지 상태면 다시 재개
          if (!open && timerState === "paused" && pendingAction === "complete") {
            handleResume();
            setPendingAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>챌린지 종료 확인</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center">
              기록 시간:{" "}
              <span className="font-semibold text-xl">
                {formatDuration(timerState === "paused" ? pausedTime : elapsedTime)}
              </span>
            </p>
            <p className="text-center mt-2 text-sm text-muted-foreground">
              이 시간으로 성공 기록을 저장하시겠습니까?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCompleteDialog(false);
                // 취소 시 타이머 재개
                if (timerState === "paused") {
                  handleResume();
                }
                setPendingAction(null);
              }}
            >
              취소
            </Button>
            <Button variant="primary" onClick={handleCompleteConfirm}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 실패 확인 다이얼로그 */}
      <Dialog
        open={showFailDialog}
        onOpenChange={(open) => {
          setShowFailDialog(open);
          // 다이얼로그가 닫히고 타이머가 일시정지 상태면 다시 재개
          if (!open && timerState === "paused" && pendingAction === "fail") {
            handleResume();
            setPendingAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>챌린지 실패 확인</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center">
              기록 시간:{" "}
              <span className="font-semibold text-xl">
                {formatDuration(timerState === "paused" ? pausedTime : elapsedTime)}
              </span>
            </p>
            <p className="text-center mt-2 text-sm text-muted-foreground">
              이 시간으로 실패 기록을 저장하시겠습니까?
            </p>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  실패 기록은 랭킹에 포함되지 않습니다.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowFailDialog(false);
                // 취소 시 타이머 재개
                if (timerState === "paused") {
                  handleResume();
                }
                setPendingAction(null);
              }}
            >
              취소
            </Button>
            <Button variant="destructive" onClick={handleFailConfirm}>
              실패 기록 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
