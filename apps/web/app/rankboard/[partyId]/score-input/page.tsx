"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { RankboardFooterNavigation } from "../../../components/RankboardFooterNavigation";
import { LevelScoreCounter } from "../../../components/ScoreCounter/LevelScoreCounter";
import { Card, CardHeader, CardTitle, CardContent } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@pkg/ui-web";
import { Calculator } from "lucide-react";
import {
  DISABLED_LEVELS,
  ENABLED_LEVELS,
  type ClimbingLevel,
  calculatePointsPerProblem,
  isScoreEligible,
  type LevelPointsConfig,
} from "@pkg/shared";
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

// 점수 계산은 이제 calculatePointsPerProblem 함수를 사용

export default function ScoreInputPage() {
  const { data: session } = useSession();
  const params = useParams();
  const partyId = params?.partyId as string;

  // 승인 요청할 개수 (입력 필드에서 사용, 승인 요청 후 0으로 리셋)
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
  // 승인된 총 개수 (누적, 읽기 전용 표시용)
  const [approvedScores, setApprovedScores] = useState<Record<LevelColor, number>>({
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [party, setParty] = useState<Party | null>(null);
  const [userLevel, setUserLevel] = useState<string>("");
  const [userTeam, setUserTeam] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [approvedTotalScore, setApprovedTotalScore] = useState(0);
  const [levelPointsConfig, setLevelPointsConfig] = useState<LevelPointsConfig | null>(null);

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
          // 승인된 총 개수 (누적)
          const approvedCounts: Record<LevelColor, number> = {
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
          };

          let approvedScore = 0;
          // 승인된 레코드의 problem_count를 합산
          // (같은 레벨에 여러 승인된 레코드가 있을 수 있음)
          (scoresResult.data.scores || []).forEach(
            (score: {
              level: ClimbingLevel;
              problem_count: number;
              approved: boolean | null;
              score: number;
            }) => {
              const color = levelColorMap[score.level];
              if (color) {
                // 승인된 레코드만 합산
                if (score.approved === true) {
                  approvedCounts[color] = (approvedCounts[color] || 0) + score.problem_count;
                }
              }
              // 승인된 점수만 합산
              if (score.approved === true) {
                approvedScore += score.score || 0;
              }
            },
          );

          // 승인된 총 개수는 별도 state로 저장
          setApprovedScores(approvedCounts);
          // 승인 요청할 개수는 항상 0으로 시작 (입력 필드 초기값)
          setScores({
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
          setApprovedTotalScore(approvedScore);
        }

        // 사용자 파티 멤버 정보 조회 (레벨, 팀)
        const memberResponse = await fetch(`/api/party/${partyId}/member`);
        const memberResult = await memberResponse.json();
        if (memberResponse.ok && memberResult.success) {
          setUserLevel(memberResult.data.level || "");
          setUserTeam(memberResult.data.team_name || "");
        }

        // party_ruleset.level_points 조회
        const rulesetResponse = await fetch(`/api/party/${partyId}/ruleset`);
        const rulesetResult = await rulesetResponse.json();
        if (rulesetResponse.ok && rulesetResult.success && rulesetResult.data?.level_points) {
          setLevelPointsConfig(rulesetResult.data.level_points);
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
    // 점수 변경 시 다이얼로그는 자동으로 닫히지 않음 (사용자가 수동으로 닫음)
  };

  // 점수 계산 (새로운 로직 적용)
  const scoreCalculation = useMemo(() => {
    if (!userLevel) return [];

    const userBaseLevel = userLevel as ClimbingLevel;
    const calculations: Array<{
      level: ClimbingLevel;
      label: string;
      count: number;
      points: number;
      pointsPerProblem: number;
    }> = [];

    levels.forEach((level) => {
      const climbingLevel = colorLevelMap[level.color];
      if (!climbingLevel) return;

      const count = scores[level.color];
      if (count > 0) {
        const pointsPerProblem = calculatePointsPerProblem(
          climbingLevel,
          userBaseLevel,
          levelPointsConfig,
        );
        const points = pointsPerProblem * count;
        if (points > 0) {
          calculations.push({
            level: climbingLevel,
            label: level.label,
            count,
            points,
            pointsPerProblem,
          });
        }
      }
    });

    return calculations;
  }, [scores, userLevel, levelPointsConfig]);

  const totalScore = useMemo(() => {
    return scoreCalculation.reduce((sum, calc) => sum + calc.points, 0);
  }, [scoreCalculation]);

  const handleSaveScore = async () => {
    if (!partyId) return;

    setSaving(true);
    setError(null);
    setShowSuccessDialog(false); // 이전 다이얼로그 닫기

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

      // 점수 저장 후 입력 필드를 0으로 리셋
      // 모든 레벨을 0으로 리셋 (승인된 개수는 approvedScores에 그대로 유지)
      const resetScores: Record<LevelColor, number> = {
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
      };
      setScores(resetScores);

      setShowSuccessDialog(true);
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
                if (!climbingLevel) return null;

                const systemDisabled = DISABLED_LEVELS.includes(climbingLevel);

                // 점수 인정 여부 확인
                const userBaseLevel = userLevel ? (userLevel as ClimbingLevel) : null;
                const isScoreEligibleLevel =
                  userBaseLevel && isScoreEligible(climbingLevel, userBaseLevel);

                // 점수 인정 안 되면 비활성화
                const isDisabled = systemDisabled || !isScoreEligibleLevel;

                // 문제당 점수 계산
                const pointsPerProblem =
                  userBaseLevel && isScoreEligibleLevel
                    ? calculatePointsPerProblem(climbingLevel, userBaseLevel, levelPointsConfig)
                    : 0;

                // 본인 레벨인지 확인
                const isUserLevel = userBaseLevel && climbingLevel === userBaseLevel;

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
                    approvedCount={approvedScores[level.color]}
                  />
                );
              })
              .filter(Boolean)}
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
                    <div key={calc.level} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {calc.label} ×{calc.count}개
                      </span>
                      <span className="font-semibold">
                        {calc.pointsPerProblem}점 × {calc.count} = {calc.points}점
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">요청 할 점수</span>
                <span className="text-xl font-bold text-primary">{totalScore}점</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">승인된 점수</span>
              <span className="font-semibold text-green-600">{approvedTotalScore}점</span>
            </div>
          </CardContent>
        </Card>

        {/* 점수 승인 요청하기 버튼 */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleSaveScore}
          disabled={totalScore === 0 || saving}
        >
          {saving ? "요청 중..." : "점수 승인 요청하기"}
        </Button>
      </main>

      <RankboardFooterNavigation partyId={partyId} />

      {/* 성공 다이얼로그 */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>점수 승인 요청</DialogTitle>
            <DialogDescription>점수 승인 요청을 보냈습니다.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
