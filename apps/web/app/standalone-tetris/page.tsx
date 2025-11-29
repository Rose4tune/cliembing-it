"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "../components/Header";
import { TetrisBoard } from "../components/Tetris/TetrisBoard";
import { StandaloneGameStartDialog } from "../components/Tetris/StandaloneGameStartDialog";
import { Button } from "@pkg/ui-web";
import { cn } from "@pkg/ui-web/lib/utils";
import {
  canPlacePiece,
  rotatePiece,
  lockPiece,
  checkCompletedLines,
  calculateHighestHeight,
  checkSpecialBlockReward,
  dropPiece,
  createNewPiece,
  type TetrisPiece,
  type BlockType,
} from "@pkg/shared";
import { calculateScore as calculateTetrisScore } from "@pkg/shared/services/tetris-game-service";
import { createClient } from "@pkg/supabase/client";
import {
  type BlockColor,
  type BlockPiece,
  convertBlocksToPieces,
  getBlockColor,
} from "../rankboard/[partyId]/tetris/[teamId]/utils";

type GameState = "idle" | "running" | "finished";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type Team = {
  id: string;
  teamNumber: number;
  name: string;
  totalScore: number;
  gameCount: number;
  totalBlocksUsed: number;
  status: string;
};

type BlockTypeOption = {
  value: BlockType;
  label: string;
  shape: number[][];
  color: BlockColor;
};

const BLOCK_TYPES: BlockTypeOption[] = [
  { value: "I", label: "I", shape: [[1, 1, 1, 1]], color: "purple" },
  {
    value: "O",
    label: "O",
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "pink",
  },
  {
    value: "T",
    label: "T",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "blue",
  },
  {
    value: "S",
    label: "S",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "red",
  },
  {
    value: "Z",
    label: "Z",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "green",
  },
  {
    value: "L-right",
    label: "J",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "orange",
  },
  {
    value: "L-left",
    label: "L",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "yellow",
  },
  { value: "special", label: "특수", shape: [[1]], color: "special" },
];

// 블럭 색상 클래스 매핑
const getBlockColorClass = (color: BlockColor): string => {
  if (!color || color === null) return "bg-gray-800";
  const colorMap: Record<Exclude<BlockColor, null>, string> = {
    blue: "bg-blue-500",
    red: "bg-red-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    yellow: "bg-yellow-500",
    special: "bg-yellow-400",
  };
  return colorMap[color] || "bg-gray-800";
};

// 블럭 미리보기 컴포넌트
const BlockPreview = ({ shape, color }: { shape: number[][]; color: BlockColor }) => {
  if (color === "special") {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-yellow-400 text-xl">⭐</span>
      </div>
    );
  }

  if (!shape || shape.length === 0) {
    return <div className={cn("w-full h-full rounded-sm", getBlockColorClass(color))} />;
  }

  const rows = shape.length;
  const firstRow = shape[0];
  const cols = firstRow?.length || 0;
  if (rows === 0 || cols === 0) {
    return <div className={cn("w-full h-full rounded-sm", getBlockColorClass(color))} />;
  }

  // 버튼 크기에 맞게 셀 크기 조정
  const cellSize = Math.min(100 / Math.max(rows, cols), 100 / 4);

  return (
    <div className="w-full h-full flex items-center justify-center p-1">
      <div
        className="w-full h-full grid"
        style={{
          gridTemplateRows: `repeat(${rows}, ${cellSize}%)`,
          gridTemplateColumns: `repeat(${cols}, ${cellSize}%)`,
        }}
      >
        {shape.map((row, rowIndex) =>
          row.map((cell, colIndex) =>
            cell ? (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={cn("rounded-md border border-black", getBlockColorClass(color))}
              />
            ) : (
              <div key={`${rowIndex}-${colIndex}`} />
            ),
          ),
        )}
      </div>
    </div>
  );
};

export default function StandaloneTetrisPage() {
  const supabase = createClient();

  const [showStartDialog, setShowStartDialog] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentGameScore, setCurrentGameScore] = useState(0); // 현재 게임의 점수
  const [completedLines, setCompletedLines] = useState(0);
  const [remainingPieces, setRemainingPieces] = useState<BlockPiece[]>([]);
  const [board, setBoard] = useState<BlockColor[][]>(
    Array(BOARD_HEIGHT)
      .fill(null)
      .map(() => Array(BOARD_WIDTH).fill(null)),
  );
  const [currentPiece, setCurrentPiece] = useState<TetrisPiece | null>(null);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const isLockingRef = useRef(false);
  const isSpawningRef = useRef(false);
  const previousHeightRef = useRef(0);
  const [isSpecialBlock, setIsSpecialBlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType>("I");
  const [blockQuantity, setBlockQuantity] = useState(1);
  const [blocksUsedInCurrentGame, setBlocksUsedInCurrentGame] = useState(0);

  // 게임 세션 로드
  const loadGameSession = useCallback(async (teamId: string) => {
    try {
      const response = await fetch(`/api/standalone-tetris/games?teamId=${teamId}`);
      const result = await response.json();

      if (result.success && result.data.games && result.data.games.length > 0) {
        const game = result.data.games[0];

        // DB 상태(idle, running, finished)에 맞게 클라이언트 상태 설정
        setGameState(
          game.status === "running" ? "running" : game.status === "finished" ? "finished" : "idle",
        );
        setCompletedLines(game.lines_cleared || 0);

        // 보드 복원
        if (game.board_snapshot?.board) {
          setBoard(game.board_snapshot.board as BlockColor[][]);
          const score = calculateTetrisScore(game.board_snapshot.board);
          setCurrentGameScore(score);
        } else {
          setBoard(
            Array(BOARD_HEIGHT)
              .fill(null)
              .map(() => Array(BOARD_WIDTH).fill(null)),
          );
          setCurrentGameScore(0);
        }

        // 대기 중인 블럭은 games.available_blocks 를 그대로 사용
        if (
          Array.isArray(game.available_blocks) &&
          game.available_blocks.length > 0 &&
          game.status !== "finished"
        ) {
          const newPieces: BlockPiece[] = game.available_blocks.map((block: any, index: number) => {
            const blockType = block.block_type || block.type;
            const blockColor = getBlockColor(blockType);
            return {
              id: block.id || `${blockType}-${index}`,
              type: blockType,
              color: blockColor,
            };
          });
          setRemainingPieces(newPieces);
        } else {
          // finished 이거나 available_blocks 가 없으면 대기열 비우기
          setRemainingPieces([]);
        }
      } else {
        // 진행 중인 게임이 없으면 초기 상태
        setGameState("idle");
        setBoard(
          Array(BOARD_HEIGHT)
            .fill(null)
            .map(() => Array(BOARD_WIDTH).fill(null)),
        );
        setRemainingPieces([]);
        setCurrentGameScore(0);
        setCompletedLines(0);
      }
    } catch (error) {
      console.error("게임 세션 로드 실패:", error);
    }
  }, []);

  // 팀 목록 조회 및 첫 번째 팀 자동 선택
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch("/api/standalone-tetris/teams");
        const result = await response.json();
        if (result.success) {
          const teamsList = result.data.teams || [];
          setTeams(teamsList);

          // 첫 번째 팀 자동 선택
          if (teamsList.length > 0 && !selectedTeamId) {
            const firstTeam = teamsList[0];
            setSelectedTeamId(firstTeam.id);
            setSelectedTeamName(firstTeam.name);
            loadGameSession(firstTeam.id);
          }
        }
      } catch (error) {
        console.error("팀 목록 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [selectedTeamId, loadGameSession]);

  // 실시간 팀 점수 업데이트 구독
  useEffect(() => {
    const channel = supabase
      .channel("standalone_tetris_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standalone_tetris_games",
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            const updatedGame = payload.new as any;
            setTeams((prev) =>
              prev.map((team) => {
                if (team.id === updatedGame.team_id) {
                  return {
                    ...team,
                    totalScore: Number(updatedGame.total_score) || 0,
                    gameCount: updatedGame.game_count || 0,
                    totalBlocksUsed: updatedGame.total_blocks_used || 0,
                    status: updatedGame.status || "idle",
                  };
                }
                return team;
              }),
            );

            // 현재 선택된 팀의 게임 상태 업데이트
            if (updatedGame.team_id === selectedTeamId) {
              if (updatedGame.status === "running") {
                setGameState("running");
              } else if (updatedGame.status === "paused") {
                setGameState("idle");
              } else if (updatedGame.status === "finished") {
                setGameState("idle");
              }
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selectedTeamId]);

  // 새 게임 시작하기
  const handleNewGame = async () => {
    try {
      const response = await fetch("/api/standalone-tetris/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });

      const result = await response.json();
      if (result.success) {
        // 모든 상태 초기화
        setTeams((prev) =>
          prev.map((team) => ({
            ...team,
            totalScore: 0,
            gameCount: 0,
            totalBlocksUsed: 0,
            status: "idle",
          })),
        );
        setSelectedTeamId(null);
        setSelectedTeamName("");
        setGameState("idle");
        setCurrentGameScore(0);
        setCompletedLines(0);
        setRemainingPieces([]);
        setBoard(
          Array(BOARD_HEIGHT)
            .fill(null)
            .map(() => Array(BOARD_WIDTH).fill(null)),
        );
        setCurrentPiece(null);
        setCurrentBlockId(null);
        setBlocksUsedInCurrentGame(0);
      } else {
        alert(result.error || "게임 초기화 실패");
      }
    } catch (error) {
      console.error("게임 초기화 실패:", error);
      alert("게임 초기화에 실패했습니다");
    }
  };

  // 기존 게임 이어하기
  const handleResumeGame = async () => {
    try {
      const response = await fetch("/api/standalone-tetris/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });

      const result = await response.json();
      if (result.success && result.data?.game) {
        const game = result.data.game;
        const team = teams.find((t) => t.id === game.team_id);
        if (team) {
          setSelectedTeamId(game.team_id);
          setSelectedTeamName(team.name);
          setGameState(
            game.status === "running"
              ? "running"
              : game.status === "finished"
                ? "finished"
                : "idle",
          );
          setCompletedLines(game.lines_cleared || 0);
          setCurrentGameScore(0); // 현재 게임 점수는 0부터 시작

          if (game.board_snapshot?.board) {
            setBoard(game.board_snapshot.board as BlockColor[][]);
            // 보드에서 현재 점수 계산
            const score = calculateTetrisScore(game.board_snapshot.board);
            setCurrentGameScore(score);
          }

          if (game.available_blocks) {
            // available_blocks는 DB에서 온 형식이므로 convertBlocksToPieces 사용
            const convertedPieces = convertBlocksToPieces(game.available_blocks);
            setRemainingPieces(convertedPieces);
          } else {
            // DB에서 블럭 목록 조회
            const blocksResponse = await fetch(
              `/api/standalone-tetris/blocks?teamId=${game.team_id}`,
            );
            const blocksResult = await blocksResponse.json();
            if (blocksResult.success) {
              const newPieces: BlockPiece[] = [];
              blocksResult.data.blocks.forEach((block: any) => {
                for (let i = 0; i < block.quantity; i++) {
                  const blockColor = getBlockColor(block.block_type);
                  newPieces.push({
                    id: `${block.id}-${i}`,
                    type: block.block_type,
                    color: blockColor,
                  });
                }
              });
              setRemainingPieces(newPieces);
            }
          }

          // 팀 정보 업데이트
          setTeams((prev) =>
            prev.map((t) => {
              if (t.id === game.team_id) {
                return {
                  ...t,
                  totalScore: Number(game.total_score) || 0,
                  gameCount: game.game_count || 0,
                  totalBlocksUsed: game.total_blocks_used || 0,
                  status: game.status || "idle",
                };
              }
              return t;
            }),
          );
        }
      } else if (result.success && !result.data?.game) {
        // 이어할 게임이 없음
        alert("이어할 게임이 없습니다. 새 게임을 시작해주세요.");
      } else {
        alert(result.error || "게임 복원 실패");
      }
    } catch (error) {
      console.error("게임 복원 실패:", error);
      alert("게임 복원에 실패했습니다");
    }
  };

  // 팀 선택 핸들러
  const handleTeamSelect = (teamId: string) => {
    // 게임 진행 중이면 팀 선택 불가
    if (gameState === "running") {
      alert("게임 진행 중에는 팀을 선택할 수 없습니다");
      return;
    }

    // 다른 팀이 게임 진행 중인지 확인
    const runningTeam = teams.find((t) => t.status === "running");
    if (runningTeam && runningTeam.id !== teamId) {
      alert("다른 팀이 게임을 진행 중입니다");
      return;
    }

    setSelectedTeamId(teamId);
    const team = teams.find((t) => t.id === teamId);
    setSelectedTeamName(team?.name || "");

    // 해당 팀의 게임 세션 로드
    loadGameSession(teamId);
  };

  // 블럭 추가 핸들러 (블럭 타입 버튼 클릭 시 바로 호출)
  const handleAddBlocks = async (blockType: BlockType) => {
    if (!selectedTeamId) {
      alert("팀을 선택해주세요");
      return;
    }

    // 게임 진행 중이면 블럭 추가 불가
    if (gameState === "running") {
      alert("게임 진행 중에는 블럭을 추가할 수 없습니다");
      return;
    }

    try {
      const response = await fetch("/api/standalone-tetris/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          blockType: blockType,
          quantity: blockQuantity,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // 로컬 대기열에 방금 추가한 블럭들을 "추가한 순서대로" 쌓기
        const addedPieces: BlockPiece[] = [];
        const blockColor = getBlockColor(blockType);
        for (let i = 0; i < blockQuantity; i++) {
          addedPieces.push({
            id: `${Date.now()}-${blockType}-${i}`,
            type: blockType,
            color: blockColor,
          });
        }
        setRemainingPieces((prev) => [...prev, ...addedPieces]);
      } else {
        alert(result.error || "블럭 추가 실패");
      }
    } catch (error) {
      console.error("블럭 추가 실패:", error);
      alert("블럭 추가에 실패했습니다");
    }
  };

  // 게임 시작 핸들러
  const handleStartGame = async () => {
    if (!selectedTeamId) {
      alert("팀을 선택해주세요");
      return;
    }

    // 현재 대기열 기준으로 게임 시작 가능 여부 체크
    if (!remainingPieces || remainingPieces.length === 0) {
      alert("블럭을 추가해주세요");
      return;
    }

    // 다른 팀이 게임 진행 중인지 확인
    const runningTeam = teams.find((t) => t.status === "running");
    if (runningTeam && runningTeam.id !== selectedTeamId) {
      alert("다른 팀이 게임을 진행 중입니다");
      return;
    }

    try {
      const response = await fetch("/api/standalone-tetris/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          action: "start",
          boardSnapshot: {
            board: board,
            // 현재 대기열(remainingPieces)을 그대로 서버에 전달
            availableBlocks: remainingPieces.map((p) => ({
              id: p.id,
              block_type: p.type,
            })),
          },
          completedLines: 0,
          totalScore: 0,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGameState("running");
        setBlocksUsedInCurrentGame(0);
        setCompletedLines(0);
        setCurrentGameScore(0);
        // 첫 블럭 생성은 gameState 변경을 감지하는 useEffect에서 처리
      } else {
        alert(result.error || "게임 시작 실패");
      }
    } catch (error) {
      console.error("게임 시작 실패:", error);
      alert("게임 시작에 실패했습니다");
    }
  };

  // 게임 중지 핸들러
  const handlePauseGame = async () => {
    if (!selectedTeamId) return;

    try {
      const response = await fetch("/api/standalone-tetris/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          action: "pause",
          boardSnapshot: {
            board: board,
            availableBlocks: remainingPieces.map((p) => ({
              id: p.id,
              block_type: p.type,
            })),
          },
          completedLines: completedLines,
          totalScore: currentGameScore,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGameState("idle");
      } else {
        alert(result.error || "게임 중지 실패");
      }
    } catch (error) {
      console.error("게임 중지 실패:", error);
      alert("게임 중지에 실패했습니다");
    }
  };

  // 게임 완료 핸들러
  const handleFinishGame = async () => {
    if (!selectedTeamId) return;

    try {
      const response = await fetch("/api/standalone-tetris/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          action: "finish",
          boardSnapshot: {
            board: board,
            availableBlocks: [],
          },
          completedLines: completedLines,
          totalScore: currentGameScore,
          blocksUsed: blocksUsedInCurrentGame,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGameState("finished");
        if (result.data?.game) {
          const game = result.data.game;
          setTeams((prev) =>
            prev.map((t) => {
              if (t.id === selectedTeamId) {
                return {
                  ...t,
                  totalScore: Number(game.total_score) || 0,
                  gameCount: game.game_count || 0,
                  totalBlocksUsed: game.total_blocks_used || 0,
                  status: "finished",
                };
              }
              return t;
            }),
          );
        }
        setCurrentGameScore(0);
        setBlocksUsedInCurrentGame(0);
      } else {
        alert(result.error || "게임 완료 실패");
      }
    } catch (error) {
      console.error("게임 완료 실패:", error);
      alert("게임 완료에 실패했습니다");
    }
  };

  // 다음 블럭 생성 (대기열에서 순서대로)
  const spawnNextPiece = useCallback(() => {
    if (isSpawningRef.current) return;
    if (remainingPieces.length === 0) {
      handleFinishGame();
      return;
    }

    isSpawningRef.current = true;

    // 대기열의 첫 번째 블럭 사용
    setRemainingPieces((prev) => {
      const selectedPiece = prev[0];
      if (!selectedPiece) {
        isSpawningRef.current = false;
        return prev;
      }

      const newPiece = createNewPiece(selectedPiece.type as BlockType);

      setCurrentPiece(newPiece);
      setCurrentBlockId(selectedPiece.id);
      setIsSpecialBlock(selectedPiece.type === "special");

      // 사용한 블럭을 제거한 나머지 대기열 반환
      return prev.slice(1);
    });

    // 블럭 사용 카운트 증가
    setBlocksUsedInCurrentGame((prev) => prev + 1);

    isSpawningRef.current = false;
  }, [remainingPieces, handleFinishGame]);

  // 블럭 고정 핸들러
  const handlePieceLock = useCallback(
    (piece: TetrisPiece) => {
      if (isLockingRef.current) return;
      if (!currentPiece || !currentBlockId) return;

      isLockingRef.current = true;

      const newBoard = lockPiece(board, piece);
      const linesCompleted = checkCompletedLines(newBoard);
      const newCompletedLines = completedLines + linesCompleted;

      setBoard(newBoard);
      setCompletedLines(newCompletedLines);

      // 점수 계산
      const newScore = calculateTetrisScore(newBoard);
      setCurrentGameScore(newScore);

      // 블럭 제거
      // spawnNextPiece 에서 이미 현재 블럭을 대기열에서 제거했으므로 여기서는 건드리지 않음

      // 게임 상태 저장
      if (selectedTeamId && gameState === "running") {
        fetch(`/api/standalone-tetris/games`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId: selectedTeamId,
            action: "update",
            boardSnapshot: {
              board: newBoard,
              // remainingPieces 는 이미 사용된 블럭을 제외한 "남은 대기 블럭"만 포함
              availableBlocks: remainingPieces.map((p) => ({
                id: p.id,
                block_type: p.type,
              })),
            },
            completedLines: newCompletedLines,
            totalScore: newScore,
          }),
        }).catch((err) => console.error("게임 상태 저장 실패:", err));
      }

      // 특수 블럭 보상 확인
      const currentHeight = calculateHighestHeight(newBoard);
      const previousHeight = previousHeightRef.current;
      const shouldRewardSpecialBlock = checkSpecialBlockReward(currentHeight, previousHeight);

      if (shouldRewardSpecialBlock) {
        const specialPiece: BlockPiece = {
          id: `special-${Date.now()}-${Math.random()}`,
          type: "special",
          color: getBlockColor("special"),
        };
        setRemainingPieces((prev) => [...prev, specialPiece]);
      }

      previousHeightRef.current = currentHeight;

      setCurrentPiece(null);
      setCurrentBlockId(null);
      setIsSpecialBlock(false);

      // 다음 블럭 생성
      setTimeout(() => {
        spawnNextPiece();
      }, 100);

      isLockingRef.current = false;
    },
    [
      board,
      currentPiece,
      currentBlockId,
      completedLines,
      remainingPieces,
      selectedTeamId,
      gameState,
      spawnNextPiece,
    ],
  );

  // 게임 컨트롤 핸들러
  const handleMove = useCallback(
    (direction: "left" | "right" | "down" | "up") => {
      if (!currentPiece || gameState !== "running") return;

      setCurrentPiece((prev) => {
        if (!prev) return null;
        const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
        const dy = direction === "down" ? 1 : direction === "up" ? -1 : 0;

        if (canPlacePiece(board, prev, dx, dy)) {
          return { ...prev, x: prev.x + dx, y: prev.y + dy };
        }

        if (direction === "down" && !isSpecialBlock && !canPlacePiece(board, prev, 0, 1)) {
          handlePieceLock(prev);
          return null;
        }

        return prev;
      });
    },
    [currentPiece, gameState, board, isSpecialBlock, handlePieceLock],
  );

  const handleRotate = useCallback(() => {
    if (!currentPiece || gameState !== "running" || isSpecialBlock) return;

    const rotatedShape = rotatePiece(currentPiece.shape);
    if (canPlacePiece(board, currentPiece, 0, 0, rotatedShape)) {
      setCurrentPiece({
        ...currentPiece,
        shape: rotatedShape,
      });
    }
  }, [currentPiece, gameState, isSpecialBlock, board]);

  const handleDrop = useCallback(() => {
    if (!currentPiece || gameState !== "running" || isSpecialBlock) return;

    const dropDistance = dropPiece(board, currentPiece, false);
    if (dropDistance > 0) {
      setCurrentPiece({
        ...currentPiece,
        y: currentPiece.y + dropDistance,
      });
      setTimeout(() => {
        const droppedPiece: TetrisPiece = {
          ...currentPiece,
          y: currentPiece.y + dropDistance,
        };
        handlePieceLock(droppedPiece);
      }, 100);
    } else {
      handlePieceLock(currentPiece);
    }
  }, [currentPiece, gameState, isSpecialBlock, board, handlePieceLock]);

  // 키보드 입력 핸들러
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (gameState !== "running" || !currentPiece) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          handleMove("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          handleMove("right");
          break;
        case "ArrowDown":
          e.preventDefault();
          handleMove("down");
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!isSpecialBlock) {
            handleRotate();
          } else {
            handleMove("up");
          }
          break;
        case " ":
        case "Space":
          e.preventDefault();
          if (!isSpecialBlock) {
            handleDrop();
          }
          break;
        case "Enter":
          e.preventDefault();
          if (isSpecialBlock) {
            handlePieceLock(currentPiece);
            setIsSpecialBlock(false);
          }
          break;
      }
    },
    [
      gameState,
      currentPiece,
      isSpecialBlock,
      handleMove,
      handleRotate,
      handleDrop,
      handlePieceLock,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  // 게임 시작 시 첫 블럭 생성
  useEffect(() => {
    if (gameState === "running" && !currentPiece && remainingPieces.length > 0) {
      spawnNextPiece();
    }
  }, [gameState, currentPiece, remainingPieces.length, spawnNextPiece]);

  // 블럭 자동 하강 (5초에 바닥까지: 250ms마다 1칸씩)
  const boardRef = useRef(board);
  const gameStateRef = useRef(gameState);
  const isSpecialBlockRef = useRef(isSpecialBlock);
  const handlePieceLockRef = useRef(handlePieceLock);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    isSpecialBlockRef.current = isSpecialBlock;
  }, [isSpecialBlock]);
  useEffect(() => {
    handlePieceLockRef.current = handlePieceLock;
  }, [handlePieceLock]);

  useEffect(() => {
    if (gameState !== "running" || isSpecialBlock) return;

    const interval = setInterval(() => {
      if (gameStateRef.current !== "running" || isSpecialBlockRef.current) {
        return;
      }

      setCurrentPiece((prev) => {
        if (!prev) return null;

        const currentBoard = boardRef.current;

        if (canPlacePiece(currentBoard, prev, 0, 1)) {
          return { ...prev, y: prev.y + 1 };
        } else {
          handlePieceLockRef.current(prev);
          return null;
        }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [gameState, isSpecialBlock]);

  // 랭킹 계산 (총점 기준)
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.teamNumber - b.teamNumber;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">로딩 중...</div>
        </main>
      </div>
    );
  }

  const isGameRunning = gameState === "running";
  const runningTeam = teams.find((t) => t.status === "running");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex justify-end py-2 px-4 border-b border-border relative">
        <div className="flex items-center justify-around gap-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground">
          <span>팀 총점</span>
          <span className="text-blue-600">{currentGameScore}</span>
          <span>완성 라인</span>
          <span className="text-green-600">{completedLines}</span>
          <span>획득 조각</span>
          <span className="text-purple-600">{remainingPieces.length}</span>
        </div>
        {/* 게임 시작 버튼 또는 게임 컨트롤 */}
        {(gameState === "idle" || gameState === "finished") && (
          <div className="flex items-center gap-4">
            <Button
              onClick={handleStartGame}
              disabled={remainingPieces.length === 0 || !!runningTeam}
              variant="primary"
              size="lg"
              className="flex-1"
            >
              게임 시작
            </Button>
          </div>
        )}

        {gameState === "running" && (
          <div className="flex items-center gap-4">
            <Button onClick={handlePauseGame} variant="secondary" size="lg" className="flex-1">
              게임 중지
            </Button>
            <Button onClick={handleFinishGame} variant="destructive" size="lg" className="flex-1">
              게임 완료
            </Button>
          </div>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 팀 리스트 */}
        <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
          <div className="space-y-4">
            {sortedTeams.map((team, index) => {
              const isSelected = team.id === selectedTeamId;
              const isRunning = team.status === "running";
              return (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team.id)}
                  disabled={isGameRunning}
                  className={`w-full py-2 px-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-2 border-primary/80 bg-primary/10"
                      : isRunning
                        ? "border-orange-500 bg-orange-50"
                        : "border-border hover:bg-muted"
                  } ${isGameRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      {team.name}
                      <span className="text-xs text-muted-foreground">
                        사용 블럭 : {team.totalBlocksUsed}개
                      </span>
                    </span>
                    <span className="font-bold">{team.totalScore}점</span>
                  </div>
                  {isRunning && <div className="text-xs text-orange-600 mt-1">게임 진행 중</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 가운데: 게임 보드 */}
        <div className="flex-1 flex justify-center bg-background space-y-6 pt-6">
          <div className="w-full h-full max-w-[500px]">
            <TetrisBoard
              board={board}
              currentPiece={currentPiece || undefined}
              specialLines={[4, 9, 14, 19]}
              nextPieces={remainingPieces}
            />
          </div>
        </div>

        {/* 오른쪽: 블럭 추가 */}
        {selectedTeamId && (
          <div className="w-60 border-l bg-muted/30 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">개수</label>
                <div className="w-full flex gap-2 mb-4">
                  <Button
                    onClick={() => setBlockQuantity(Math.max(1, blockQuantity - 1))}
                    variant="outline"
                    size="icon"
                    disabled={isGameRunning}
                  >
                    -
                  </Button>
                  <input
                    type="number"
                    min="1"
                    value={blockQuantity}
                    onChange={(e) => setBlockQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full py-1 border rounded text-center"
                    disabled={isGameRunning}
                  />
                  <Button
                    onClick={() => setBlockQuantity(blockQuantity + 1)}
                    variant="outline"
                    size="icon"
                    disabled={isGameRunning}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">블럭 타입</label>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCK_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      onClick={() => handleAddBlocks(type.value)}
                      variant="outline"
                      className={`aspect-square h-22 flex flex-col items-center justify-center p-0 ${selectedBlockType === type.value ? "border-2 bg-primary/10" : ""}`}
                      disabled={isGameRunning}
                    >
                      <BlockPreview shape={type.shape} color={type.color} />
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 게임 시작 다이얼로그 */}
      <StandaloneGameStartDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onNewGame={handleNewGame}
        onResumeGame={handleResumeGame}
      />
    </div>
  );
}
