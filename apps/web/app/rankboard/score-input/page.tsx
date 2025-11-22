"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Header } from "../../components/Header";
import { RankboardFooterNavigation } from "../../components/RankboardFooterNavigation";
import { LevelScoreCounter } from "../../components/ScoreCounter/LevelScoreCounter";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Calculator } from "lucide-react";

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

const levels: { color: LevelColor; label: string }[] = [
  { color: "red", label: "Red" },
  { color: "orange", label: "Orange" },
  { color: "yellow", label: "Yellow" },
  { color: "green", label: "Green" },
  { color: "blue", label: "Blue" },
  { color: "navy", label: "Navy" },
  { color: "purple", label: "Purple" },
  { color: "hite", label: "Hite" },
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
  const [scores, setScores] = useState<Record<LevelColor, number>>({
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
    blue: 0,
    navy: 0,
    purple: 0,
    hite: 0,
    white: 0,
    black: 0,
  });

  // Mock data
  const partyInfo = {
    name: "볼더링 파티 #2025",
    status: "진행중",
    participants: 24,
    teams: 10,
    timeRemaining: "01:05:12",
    progress: 65,
  };

  const userLevel = "Purple"; // 이 값은 세션에서 가져와야 함
  const userTeam = "1"; // 이 값은 세션에서 가져와야 함

  const handleScoreChange = (level: LevelColor, score: number) => {
    setScores((prev) => ({
      ...prev,
      [level]: score,
    }));
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

  const handleSaveScore = () => {
    // TODO: API 호출로 점수 저장
    console.log("Saving scores:", scores);
    console.log("Total score:", totalScore);
    alert("점수가 저장되었습니다!");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        variant="dashboard"
        partyName={partyInfo.name}
        userName={session?.user?.name || "김클라임"}
        team={userTeam}
        level={userLevel}
      />

      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {/* 내 기준 레벨 섹션 */}
        <Card className="space-y-4">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>내 기준 레벨</CardTitle>
            <p className="text-2xl font-bold text-[--color-level-purple-dark]">{userLevel}</p>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* 문제 해결 개수 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle>문제 해결 개수</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {levels.map((level) => (
              <LevelScoreCounter
                key={level.color}
                level={level.color}
                levelLabel={level.label}
                score={scores[level.color]}
                onChange={(score) => handleScoreChange(level.color, score)}
                isMine={true}
                disabled={false}
                pointsPerProblem={1}
              />
            ))}
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
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="font-semibold">총 점수</span>
                  <span className="text-xl font-bold text-primary">{totalScore}점</span>
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
          disabled={totalScore === 0}
        >
          점수 저장하기
        </Button>
      </main>

      <RankboardFooterNavigation />
    </div>
  );
}
