"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { RankboardFooterNavigation } from "../../../components/RankboardFooterNavigation";
import { LevelScoreCounter } from "../../../components/ScoreCounter/LevelScoreCounter";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Calculator } from "lucide-react";
import { DISABLED_LEVELS, ENABLED_LEVELS, type ClimbingLevel } from "@pkg/shared";
import type { Party } from "@pkg/shared";

type LevelColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "navy"
  | "purple"
  | "hite"
  | "white"
  | "black";

// 레벨 매핑: ClimbingLevel -> LevelColor
const levelColorMap: Record<ClimbingLevel, LevelColor> = {
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
  Blue: "blue",
  Navy: "navy",
  Purple: "purple",
  Hite: "hite",
  White: "white",
  Black: "black",
};

const colorLevelMap: Record<LevelColor, ClimbingLevel | null> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  navy: "Navy",
  purple: "Purple",
  hite: "Hite",
  white: "White",
  black: "Black",
};

const levels: { color: LevelColor; label: string }[] = [
  { color: "red", label: "Red" },
  { color: "orange", label: "Orange" },
  { color: "yellow", label: "Yellow" },
  { color: "green", label: "Green" },
  { color: "blue", label: "Blue" },
  { color: "navy", label: "Navy" },
  { color: "purple", label: "Purple" },
  // Hite는 점수 입력 화면에서 제외
  { color: "white", label: "White" },
  { color: "black", label: "Black" },
];

// 점수 계산 로직: 레벨별로 다른 점수 배수
// 이미지 기준: 레벨 1-5 = 1점/문제, 레벨 6 = 6점/문제, 레벨 9 = 21점/문제
const getPointsPerProblem = (levelIndex: number): number => {
  // levelIndex는 0부터 시작 (Red=0, Orange=1, ..., Black=9)
  // 실제 레벨 번호는 levelIndex + 1
  const levelNumber = levelIndex + 1;

  if (levelNumber <= 5) {
    // 레벨 1-5: 문제당 1점
    return 1;
  } else if (levelNumber === 6) {
    // 레벨 6: 문제당 6점
    return 6;
  } else if (levelNumber === 9) {
    // 레벨 9: 문제당 21점
    return 21;
  } else {
    // 레벨 7, 8, 10: 중간 값 (임시로 설정, 나중에 조정 필요)
    // 레벨 7 = 7점, 레벨 8 = 14점, 레벨 10 = 30점 (예상)
    return levelNumber === 7 ? 7 : levelNumber === 8 ? 14 : 30;
  }
};

const getPointsForLevel = (levelIndex: number, count: number): number => {
  if (count === 0) return 0;
  return getPointsPerProblem(levelIndex) * count;
};

export default function ScoreInputPage() {
  const { data: session } = useSession();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [scores, setScores] = useState<Record<LevelColor, number>>({
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    blue: 0,
    navy: 0,
    purple: 0,
    hite: 0, // Hite는 상태는 유지하되 UI에서 숨김
    white: 0,
    black: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [party, setParty] = useState<Party | null>(null);
  const [userLevel, setUserLevel] = useState<string>("");
  const [userTeam, setUserTeam] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [approvedTotalScore, setApprovedTotalScore] = useState(0);

  // 파티 정보 및 사용자 정보 조회
  useEffect(() => {
    if (!partyId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // 파티 정보 조회
        const partyResponse = await fetch(`/api/party/${partyId}`);
        const partyResult = await partyResponse.json();
        if (partyResult.success) {
          setParty(partyResult.data);
        }

        // 사용자 점수 조회 (기존 점수 불러오기)
        const scoresResponse = await fetch(`/api/party/${partyId}/scores`);
        const scoresResult = await scoresResponse.json();
        if (scoresResponse.ok && scoresResult.success) {
          const existingScores: Record<LevelColor, number> = {
            red: 0,
            orange: 0,
            yellow: 0,
            green: 0,
            blue: 0,
            navy: 0,
            purple: 0,
            hite: 0, // Hite는 상태는 유지하되 UI에서 숨김
            white: 0,
            black: 0,
          };

          let approvedScore = 0;
          (scoresResult.data.scores || []).forEach(
            (score: {
              level: ClimbingLevel;
              problem_count: number;
              approved: boolean | null;
              score: number;
            }) => {
              const color = levelColorMap[score.level];
              if (color) {
                existingScores[color] = score.problem_count;
              }
              // 승인된 점수만 합산
              if (score.approved === true) {
                approvedScore += score.score || 0;
              }
            },
          );

          setScores(existingScores);
          setApprovedTotalScore(approvedScore);
        }

        // 사용자 파티 멤버 정보 조회 (레벨, 팀)
        const memberResponse = await fetch(`/api/party/${partyId}/member`);
        const memberResult = await memberResponse.json();
        if (memberResponse.ok && memberResult.success) {
          setUserLevel(memberResult.data.level || "");
          setUserTeam(memberResult.data.team_name || "");
        }
      } catch (error) {
        console.error("데이터 조회 에러:", error);
        setError("데이터를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [partyId]);

  const handleScoreChange = (level: LevelColor, score: number) => {
    setScores((prev) => ({
      ...prev,
      [level]: score,
    }));
    setSuccess(false);
  };

  // 점수 계산
  const scoreCalculation = useMemo(() => {
    const calculations: Array<{
      levelIndex: number;
      label: string;
      count: number;
      points: number;
    }> = [];

    levels.forEach((level, index) => {
      const count = scores[level.color];
      if (count > 0) {
        const points = getPointsForLevel(index, count);
        calculations.push({
          levelIndex: index + 1,
          label: level.label,
          count,
          points,
        });
      }
    });

    return calculations;
  }, [scores]);

  const totalScore = useMemo(() => {
    return scoreCalculation.reduce((sum, calc) => sum + calc.points, 0);
  }, [scoreCalculation]);

  const handleSaveScore = async () => {
    if (!partyId) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // 활성화된 레벨만 저장
      const savePromises = ENABLED_LEVELS.map(async (level) => {
        const color = levelColorMap[level];
        if (!color) return null;

        const problemCount = scores[color];
        if (problemCount === 0) return null;

        const response = await fetch(`/api/party/${partyId}/scores`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            level,
            problemCount,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "점수 저장에 실패했습니다");
        }

        return result.data;
      });

      await Promise.all(savePromises.filter((p) => p !== null));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("점수 저장 에러:", error);
      setError(error instanceof Error ? error.message : "점수 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  // 남은 시간 계산
  const timeRemaining = useMemo(() => {
    if (!party?.end_at) return "00:00:00";
    const endTime = new Date(party.end_at).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [party?.end_at]);

  // 진행률 계산
  const progress = useMemo(() => {
    if (!party?.start_at || !party?.end_at) return 0;
    const startTime = new Date(party.start_at).getTime();
    const endTime = new Date(party.end_at).getTime();
    const now = Date.now();
    const total = endTime - startTime;
    const elapsed = now - startTime;
    return Math.min(100, Math.max(0, Math.floor((elapsed / total) * 100)));
  }, [party?.start_at, party?.end_at]);

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

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        variant="dashboard"
        partyName={party?.name || "파티"}
        userName={
          session?.user?.name ||
          (session?.user as { nickname?: string | null })?.nickname ||
          "사용자"
        }
        team={userTeam}
        level={userLevel}
      />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {/* 에러 메시지 */}
        {error && (
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <div className="text-red-600 text-sm">{error}</div>
            </CardContent>
          </Card>
        )}

        {/* 성공 메시지 */}
        {success && (
          <Card className="border-green-500">
            <CardContent className="pt-6">
              <div className="text-green-600 text-sm">점수가 저장되었습니다</div>
            </CardContent>
          </Card>
        )}

        {/* 내 기준 레벨 섹션 */}
        <Card className="space-y-4">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>내 기준 레벨</CardTitle>
            <p className="text-2xl font-bold text-[--color-level-purple-dark]">
              {userLevel || "-"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">남은 시간</span>
                <span className="font-semibold">{timeRemaining}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 문제 해결 개수 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle>문제 해결 개수</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {levels
              .filter((level) => level.color !== "hite") // Hite 제외
              .map((level) => {
                const climbingLevel = colorLevelMap[level.color];
                const isDisabled = climbingLevel ? DISABLED_LEVELS.includes(climbingLevel) : false;
                const levelIndex = levels.findIndex((l) => l.color === level.color);
                const pointsPerProblem = getPointsPerProblem(levelIndex);
                // 본인 레벨인지 확인
                const isUserLevel = userLevel && climbingLevel === userLevel;

                return (
                  <LevelScoreCounter
                    key={level.color}
                    level={level.color}
                    levelLabel={level.label}
                    score={scores[level.color]}
                    onChange={(score) => handleScoreChange(level.color, score)}
                    isMine={isUserLevel || false}
                    disabled={isDisabled}
                    pointsPerProblem={pointsPerProblem}
                  />
                );
              })}
          </CardContent>
        </Card>

        {/* 점수 계산 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              점수 계산
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scoreCalculation.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                문제를 입력하면 점수가 계산됩니다
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {scoreCalculation.map((calc) => (
                    <div
                      key={calc.levelIndex}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        레벨 {calc.levelIndex} ×{calc.count}개
                      </span>
                      <span className="font-semibold">
                        {getPointsPerProblem(calc.levelIndex - 1)}점 × {calc.count} = {calc.points}
                        점
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">총 점수</span>
                    <span className="text-xl font-bold text-primary">{totalScore}점</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">승인된 점수</span>
                    <span className="font-semibold text-green-600">{approvedTotalScore}점</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 점수 저장하기 버튼 */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleSaveScore}
          disabled={totalScore === 0 || saving}
        >
          {saving ? "저장 중..." : "점수 저장하기"}
        </Button>
      </main>

      <RankboardFooterNavigation partyId={partyId} />
    </div>
  );
}
