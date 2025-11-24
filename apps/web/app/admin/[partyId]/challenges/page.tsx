"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { AdminSidebar } from "../../../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Input } from "@pkg/ui-web";
import { Clock, Play, Square, Save } from "lucide-react";

type ChallengeRecord = {
  id: string;
  team_number: number;
  time: string;
  challenge_type: string;
  created_at: string;
};

export default function ChallengesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [records, setRecords] = useState<ChallengeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [challengeType, setChallengeType] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && partyId) {
      fetchRecords();
    }
  }, [status, partyId, router]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/${partyId}/challenges`);
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

  const handleStart = () => {
    if (!selectedTeam) {
      alert("팀을 선택해주세요.");
      return;
    }
    setIsRunning(true);
    setStartTime(Date.now());
    setElapsedTime(0);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  const handleSave = async () => {
    if (!selectedTeam || !challengeType) {
      alert("팀과 챌린지 유형을 입력해주세요.");
      return;
    }

    const timeString = formatTime(elapsedTime);

    try {
      const response = await fetch(`/api/admin/${partyId}/challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamNumber: selectedTeam,
          time: timeString,
          challengeType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "챌린지 기록을 저장할 수 없습니다");
      }

      fetchRecords();
      handleReset();
      setSelectedTeam(null);
      setChallengeType("");
      alert("챌린지 기록이 저장되었습니다.");
    } catch (err) {
      console.error("챌린지 기록 저장 에러:", err);
      alert(err instanceof Error ? err.message : "챌린지 기록 저장에 실패했습니다");
    }
  };

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(2, "0")}`;
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

  return (
    <div className="flex min-h-screen flex-col ml-20">
      <Header variant="login" title="챌린지 기록" />

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 space-y-6 pb-6">
        {/* 스탑워치 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              챌린지 스탑워치
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-6xl font-mono font-bold">{formatTime(elapsedTime)}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">팀 번호</label>
                  <Input
                    type="number"
                    min="1"
                    value={selectedTeam || ""}
                    onChange={(e) =>
                      setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)
                    }
                    disabled={isRunning}
                    className="mt-2"
                    placeholder="팀 번호 입력"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">챌린지 유형</label>
                  <Input
                    value={challengeType}
                    onChange={(e) => setChallengeType(e.target.value)}
                    disabled={isRunning}
                    className="mt-2"
                    placeholder="챌린지 유형 입력"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                {!isRunning ? (
                  <>
                    <Button variant="primary" onClick={handleStart} disabled={!selectedTeam}>
                      <Play className="h-4 w-4 mr-1" />
                      시작
                    </Button>
                    {elapsedTime > 0 && (
                      <Button variant="outline" onClick={handleReset}>
                        리셋
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="destructive" onClick={handleStop}>
                      <Square className="h-4 w-4 mr-1" />
                      정지
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                      <Save className="h-4 w-4 mr-1" />
                      저장
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 기록 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>챌린지 기록 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                저장된 챌린지 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-semibold">{record.team_number}조</div>
                      <div className="text-sm text-muted-foreground">{record.challenge_type}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(record.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                    <div className="text-2xl font-mono font-bold">{record.time}</div>
                  </div>
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
