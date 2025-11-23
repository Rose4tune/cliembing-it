"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Header } from "../../../components/Header";
import { RankboardFooterNavigation } from "../../../components/RankboardFooterNavigation";
import { TeamGameStatusCard } from "../../../components/Tetris/TeamGameStatusCard";
import { TetrisBoard } from "../../../components/Tetris/TetrisBoard";
import { GameControls } from "../../../components/Tetris/GameControls";
import { GameStartDialog } from "../../../components/Tetris/GameStartDialog";
import { TeamRanking } from "../../../components/Tetris/TeamRanking";
import { Card, CardContent, CardHeader, CardTitle } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Info } from "lucide-react";
import type { Party } from "@pkg/shared";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type BlockColor =
  | "blue"
  | "red"
  | "green"
  | "purple"
  | "orange"
  | "pink"
  | "yellow"
  | "special"
  | null;

type GameState = "idle" | "requested" | "confirmed" | "playing" | "finished";

export default function TetrisPage() {
  const { data: session } = useSession();
  const params = useParams();
  const partyId = params?.partyId as string;

  const [gameState, setGameState] = useState<GameState>("idle");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showGameRules, setShowGameRules] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("01:05:12");
  const [teamTotalScore, setTeamTotalScore] = useState(0);
  const [completedLines, setCompletedLines] = useState(0);
  const [remainingPieces, setRemainingPieces] = useState<BlockColor[]>([
    "blue",
    "purple",
    "green",
    "orange",
    "special",
    "red",
    "pink",
  ]);
  const [board, setBoard] = useState<BlockColor[][]>(
    Array(BOARD_HEIGHT)
      .fill(null)
      .map(() => Array(BOARD_WIDTH).fill(null)),
  );
  const [currentPiece, setCurrentPiece] = useState<{
    x: number;
    y: number;
    shape: number[][];
    color: BlockColor;
  } | null>(null);
  const [isSpecialBlock, setIsSpecialBlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [userLevel, setUserLevel] = useState<string>("");
  const [userTeam, setUserTeam] = useState<string>("");
  const [teamRankings, setTeamRankings] = useState<any[]>([]);

  // 획득 조각 = 대기 중인 사용 안한 블럭의 수
  const acquiredPieces = remainingPieces.length;

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

        // 사용자 파티 멤버 정보 조회 (레벨, 팀)
        const memberResponse = await fetch(`/api/party/${partyId}/member`);
        const memberResult = await memberResponse.json();
        if (memberResponse.ok && memberResult.success) {
          setUserLevel(memberResult.data.level || "");
          setUserTeam(memberResult.data.team_number?.toString() || "");
        }

        // TODO: 팀 랭킹 조회 API (아직 구현되지 않음)
        // const rankingsResponse = await fetch(`/api/party/${partyId}/team-rankings`);
        // const rankingsResult = await rankingsResponse.json();
        // if (rankingsResult.success) {
        //   setTeamRankings(rankingsResult.data.rankings || []);
        // }
      } catch (error) {
        console.error("데이터 조회 에러:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [partyId]);

  // 남은 시간 계산
  useEffect(() => {
    if (!party?.end_at) return;

    const updateTime = () => {
      const endTime = new Date(party.end_at!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      setTimeRemaining(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [party?.end_at]);

  // 게임 시작 요청
  const handleRequestGameStart = () => {
    if (acquiredPieces === 0) {
      alert("게임 대기에 추가된 블럭이 없습니다.");
      return;
    }
    setGameState("requested");
    // TODO: API 호출로 스탭에게 요청 전달
    console.log("게임 시작 요청 전송");
  };

  // 게임 시작 확인 (스탭이 확인한 경우)
  const handleGameStartConfirmed = () => {
    setGameState("confirmed");
    setShowStartDialog(true);
  };

  // 게임 시작
  const handleStartGame = () => {
    setGameState("playing");
    // 게임 시작 로직
    console.log("게임 시작");
  };

  // 게임 컨트롤 핸들러
  const handleMove = useCallback(
    (direction: "left" | "right" | "down" | "up") => {
      if (!currentPiece || gameState !== "playing") return;

      setCurrentPiece((prev) => {
        if (!prev) return null;
        const newX = prev.x + (direction === "left" ? -1 : direction === "right" ? 1 : 0);
        const newY = prev.y + (direction === "down" ? 1 : direction === "up" ? -1 : 0);

        // 보드 범위 체크
        if (newX < 0 || newX >= BOARD_WIDTH) return prev;
        if (newY < 0 || newY >= BOARD_HEIGHT) return prev;

        return { ...prev, x: newX, y: newY };
      });
    },
    [currentPiece, gameState],
  );

  const handleRotate = useCallback(() => {
    if (!currentPiece || gameState !== "playing" || isSpecialBlock) return;
    // 회전 로직은 간단히 생략 (실제로는 더 복잡함)
    console.log("회전");
  }, [currentPiece, gameState, isSpecialBlock]);

  const handleDrop = useCallback(() => {
    if (!currentPiece || gameState !== "playing" || isSpecialBlock) return;
    // 드랍 로직: 즉시 맨 아래로 떨어뜨림
    setCurrentPiece((prev) => {
      if (!prev) return null;
      // 보드의 맨 아래로 이동
      return { ...prev, y: BOARD_HEIGHT - 1 };
    });
    // TODO: 블럭을 보드에 고정
  }, [currentPiece, gameState, isSpecialBlock]);

  const handleConfirm = useCallback(() => {
    if (!currentPiece || gameState !== "playing" || !isSpecialBlock) return;
    // 특수 블럭 확정
    // TODO: 블럭을 보드에 고정
    setIsSpecialBlock(false);
    setCurrentPiece(null);
  }, [currentPiece, gameState, isSpecialBlock]);

  // 게임 종료 체크
  useEffect(() => {
    if (gameState === "playing" && remainingPieces.length === 0 && !currentPiece) {
      setGameState("finished");
      // TODO: 게임 종료 처리
    }
  }, [gameState, remainingPieces, currentPiece]);

  // 스탭 확인 시뮬레이션 (실제로는 API에서 받아옴)
  useEffect(() => {
    if (gameState === "requested") {
      // 2초 후 스탭이 확인한 것으로 시뮬레이션
      const timer = setTimeout(() => {
        handleGameStartConfirmed();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

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

  // Mock team rankings (TODO: API로 교체)
  const mockTeamRankings = [
    {
      rank: 1,
      teamNumber: 3,
      totalScore: 1247,
      completedLines: 15,
      usedPieces: 12,
      totalPieces: 15,
      members: [
        { name: "김클라임", level: "Gray" },
        { name: "박클라임", level: "Purple" },
        { name: "이클라임", level: "Gray" },
        { name: "정클라임", level: "Blue" },
      ],
    },
    {
      rank: 2,
      teamNumber: 2,
      totalScore: 1247,
      completedLines: 15,
      usedPieces: 12,
      totalPieces: 15,
    },
    {
      rank: 3,
      teamNumber: 7,
      totalScore: 1247,
      completedLines: 15,
      usedPieces: 12,
      totalPieces: 15,
    },
    {
      rank: 4,
      teamNumber: 1,
      totalScore: 1247,
      completedLines: 15,
      usedPieces: 12,
      totalPieces: 15,
      members: [
        { name: "김클라임", level: "Gray" },
        { name: "박클라임", level: "Purple" },
        { name: "이클라임", level: "Gray" },
        { name: "정클라임", level: "Blue" },
      ],
    },
  ];

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
        {/* 팀 게임 현황 */}
        <TeamGameStatusCard
          teamTotalScore={teamTotalScore}
          completedLines={completedLines}
          acquiredPieces={acquiredPieces}
          timeRemaining={gameState === "playing" ? timeRemaining : undefined}
        />

        {/* 테트리스 게임 보드 */}
        <div className="space-y-4">
          <TetrisBoard
            board={board}
            currentPiece={currentPiece || undefined}
            specialLines={[5, 10, 15]}
            nextPieces={remainingPieces}
          />

          {/* 게임 시작 버튼 또는 게임 컨트롤 */}
          {gameState === "idle" || gameState === "finished" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="lg"
                className="flex-2"
                onClick={handleRequestGameStart}
                disabled={acquiredPieces === 0}
              >
                게임 시작 요청하기
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setShowGameRules(!showGameRules)}
                aria-label="게임 규칙 보기"
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          ) : gameState === "playing" ? (
            <GameControls
              onMove={handleMove}
              onRotate={handleRotate}
              onDrop={handleDrop}
              onConfirm={handleConfirm}
              isSpecialBlock={isSpecialBlock}
              disabled={false}
            />
          ) : null}
        </div>

        {/* 게임 규칙 안내 */}
        {showGameRules && (
          <Card className="animate-in fade-in slide-in-from-top-2 duration-200">
            <CardHeader>
              <CardTitle>게임 규칙</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 점수 득점 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">점수 득점</h3>
                <p className="text-sm text-muted-foreground">
                  각 라인에 포함된 색깔 수 별로 획득 점수 다름
                </p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>8색: 20점</div>
                  <div>7색: 15점</div>
                  <div>6색: 12점</div>
                  <div>5색: 9점</div>
                  <div>4색: 7점</div>
                  <div>3색: 5점</div>
                  <div>2색: 3점</div>
                  <div>1색: 1점</div>
                </div>
              </div>

              {/* 특수 블록 획득 규칙 */}
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">특수 블록 획득</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 높이로 5줄마다 1개 (라인 완성 상관 없음)</li>
                  <li>
                    • 특수 블록은 획득하는 시점에 사용 가능 블럭에 표시가 되며 원하는 위치에
                    자유롭게 배치할 수 있습니다.
                  </li>
                  <li>• 팀원이 문제 풀은 순서대로 조각이 쌓입니다.</li>
                  <li>
                    • 게임은 팀장 화면에서만 플레이 가능하며, 스탭이 게임 진행을 확인해주면 플레이
                    가능합니다.
                  </li>
                  <li>• 게임은 파티 시간 동안 몇 번이고 진행 가능합니다.</li>
                  <li>• 완성된 라인은 제거되지 않고 표시됩니다.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 실시간 팀 랭킹 */}
        <TeamRanking teams={teamRankings.length > 0 ? teamRankings : mockTeamRankings} />
      </main>

      <RankboardFooterNavigation partyId={partyId} />

      {/* 게임 시작 다이얼로그 */}
      <GameStartDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onConfirm={handleStartGame}
      />
    </div>
  );
}
