"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "../../../../components/Header";
import { RankboardFooterNavigation } from "../../../../components/RankboardFooterNavigation";
import { TeamGameStatusCard } from "../../../../components/Tetris/TeamGameStatusCard";
import { TetrisBoard } from "../../../../components/Tetris/TetrisBoard";
import { GameControls } from "../../../../components/Tetris/GameControls";
import { GameStartDialog } from "../../../../components/Tetris/GameStartDialog";
import { TeamRanking } from "../../../../components/Tetris/TeamRanking";
import { Card, CardContent, CardHeader, CardTitle } from "@pkg/ui-web";
import { Button } from "@pkg/ui-web";
import { Info } from "lucide-react";
import type { Party } from "@pkg/shared";
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

type GameState = "inactive" | "pending" | "requesting" | "ready" | "running" | "finished";

export default function TetrisPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const partyId = params?.partyId as string;
  const teamId = params?.teamId as string;

  const [gameState, setGameState] = useState<GameState>("inactive");
  const [dbGameStatus, setDbGameStatus] = useState<string | null>(null); // DB의 실제 상태 저장 (idle vs inactive 구분용)
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showGameRules, setShowGameRules] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("01:05:12");
  const [teamTotalScore, setTeamTotalScore] = useState(0);
  const [completedLines, setCompletedLines] = useState(0);
  const [remainingPieces, setRemainingPieces] = useState<
    Array<{ type: string; color: BlockColor }>
  >([]);
  const [board, setBoard] = useState<BlockColor[][]>(
    Array(BOARD_HEIGHT)
      .fill(null)
      .map(() => Array(BOARD_WIDTH).fill(null)),
  );
  const [currentPiece, setCurrentPiece] = useState<TetrisPiece | null>(null);
  const [previousHeight, setPreviousHeight] = useState(0);
  const [isSpecialBlock, setIsSpecialBlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [userLevel, setUserLevel] = useState<string>("");
  const [userTeam, setUserTeam] = useState<string>("");
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [teamRankings, setTeamRankings] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 획득 조각 = 대기 중인 사용 안한 블럭의 수
  const acquiredPieces = remainingPieces.length;

  // 파티 정보 및 사용자 정보 조회
  useEffect(() => {
    if (!partyId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 파티 정보 조회
        const partyResponse = await fetch(`/api/party/${partyId}`);
        const partyResult = await partyResponse.json();
        if (partyResponse.ok && partyResult.success) {
          setParty(partyResult.data);
          console.log("📊 파티 정보 로드 성공:", {
            id: partyResult.data?.id,
            name: partyResult.data?.name,
            status: partyResult.data?.status,
          });
        } else {
          console.error("❌ 파티 정보 조회 실패:", {
            ok: partyResponse.ok,
            status: partyResponse.status,
            result: partyResult,
          });
          setError(`파티 정보를 불러올 수 없습니다: ${partyResult.error || "알 수 없는 오류"}`);
        }

        // 사용자 파티 멤버 정보 조회 (레벨, 팀, 팀장 여부)
        const memberResponse = await fetch(`/api/party/${partyId}/member`);
        const memberResult = await memberResponse.json();
        if (memberResponse.ok && memberResult.success) {
          setUserLevel(memberResult.data.level || "");
          setUserTeam(memberResult.data.team_name || "");
          setIsLeader(memberResult.data.is_leader || false);
          const memberTeamId = memberResult.data.team_id;

          if (!memberTeamId) {
            setError("팀에 속해있지 않습니다");
            setLoading(false);
            return;
          }

          setUserTeamId(memberTeamId);

          // URL의 teamId와 사용자 팀 ID가 다르면 리다이렉트
          if (teamId && teamId !== memberTeamId) {
            router.replace(`/rankboard/${partyId}/tetris/${memberTeamId}`);
            return;
          }

          // teamId가 없으면 사용자의 팀 ID로 리다이렉트
          if (!teamId && memberTeamId) {
            router.replace(`/rankboard/${partyId}/tetris/${memberTeamId}`);
            return;
          }

          const currentTeamId = teamId || memberTeamId;

          // 팀 점수 조회 (테트리스 게임 점수)
          const teamScoreResponse = await fetch(
            `/api/party/${partyId}/team-score?teamId=${currentTeamId}`,
          );
          const teamScoreResult = await teamScoreResponse.json();
          if (teamScoreResponse.ok && teamScoreResult.success) {
            setTeamTotalScore(teamScoreResult.data.teamScore || 0);
          }

          // 게임 세션 조회 (있는 경우)
          let gameSessionData: any = null;
          const gameSessionResponse = await fetch(
            `/api/party/${partyId}/game-session?teamId=${currentTeamId}`,
          );

          console.log("🔍 게임 세션 조회 응답:", {
            status: gameSessionResponse.status,
            ok: gameSessionResponse.ok,
          });

          if (gameSessionResponse.ok) {
            const gameSessionResult = await gameSessionResponse.json();
            console.log("🔍 게임 세션 결과:", gameSessionResult);
            console.log("🔍 gameSessionResult.data:", gameSessionResult.data);
            console.log("🔍 gameSessionResult.data?.id:", gameSessionResult.data?.id);

            // API가 성공 응답을 반환했지만 실제 게임 세션 데이터가 있는지 확인
            if (!gameSessionResult.success) {
              // API가 실패 응답을 반환한 경우
              const errorMessage = gameSessionResult.error || "게임 세션 조회에 실패했습니다";
              console.error("❌ 게임 세션 조회 실패:", errorMessage);
              setError(`게임 세션을 불러올 수 없습니다: ${errorMessage}`);
              setLoading(false);
              return;
            }

            // 게임 세션 데이터가 실제로 있는지 확인 (id 필드가 있는지 확인)
            if (!gameSessionResult.data || !gameSessionResult.data.id) {
              // 게임 세션이 없는 경우 (팀 생성 시 자동으로 생성되어야 하므로 에러)
              const errorMessage =
                "게임 세션을 찾을 수 없습니다. 팀 생성 시 게임 세션이 자동으로 생성되어야 합니다.";
              console.error("❌ 게임 세션이 없습니다:", errorMessage);
              console.error(
                "🔍 gameSessionResult 전체 구조:",
                JSON.stringify(gameSessionResult, null, 2),
              );
              setError(errorMessage);
              setLoading(false);
              return;
            }

            gameSessionData = gameSessionResult.data;
            const session = gameSessionResult.data;
            console.log("🔍 게임 세션 데이터:", session);

            // DB의 status를 프론트엔드 GameState로 매핑
            // "inactive" -> "inactive" (초기 상태, 게임 시작 요청 가능, 버튼: "게임 시작 요청하기")
            // "requesting" -> "requesting" (승인 대기 중, 메시지: "관리자 승인을 기다리는 중...")
            // "ready" -> "ready" (승인 완료, 게임 시작 대기, 다이얼로그 표시)
            // "running" -> "running" (게임 진행 중, 게임 컨트롤 표시)
            // "pending" -> "pending" (게임 데이터 있음, 팀 삭제됨, 더 이상 사용 불가능)
            // "finished" -> "finished" (파티 종료, 게임 재시작 불가)
            // DB 상태 저장 (idle vs inactive vs pending 구분용)
            setDbGameStatus(session.status);

            let mappedState: GameState = "inactive";
            if (session.status === "inactive") {
              // inactive: 초기 상태, 게임 시작 요청 가능
              mappedState = "inactive";
            } else if (session.status === "requesting") {
              // requesting: 승인 대기 중
              mappedState = "requesting";
            } else if (session.status === "ready") {
              // ready: 승인 완료, 게임 시작 대기, 다이얼로그 표시
              mappedState = "ready";
              setShowStartDialog(true);
            } else if (session.status === "running") {
              // running: 게임 진행 중
              mappedState = "running";
            } else if (session.status === "pending") {
              // pending: 게임 데이터 있음, 팀 삭제됨, 더 이상 사용 불가능 (비활성화)
              mappedState = "pending";
            } else if (session.status === "finished") {
              // finished: 파티 종료, 게임 재시작 불가
              mappedState = "finished";
            } else if (session.status === "cancelled") {
              // cancelled: 파티 종료, 게임 재시작 불가
              mappedState = "finished";
            } else if (session.status === "idle") {
              // idle: 비활성화 상태 (팀 삭제 등)
              mappedState = "pending";
            }
            setGameState(mappedState);
            if (session.board_state) {
              setBoard(session.board_state);
            }
            setCompletedLines(session.completed_lines || 0);
          } else {
            // 게임 세션 조회 실패 시 에러 처리
            const errorResult = await gameSessionResponse
              .json()
              .catch(() => ({ error: "알 수 없는 오류" }));
            const errorMessage =
              errorResult.error || `게임 세션 조회에 실패했습니다 (${gameSessionResponse.status})`;
            console.error("❌ 게임 세션 조회 실패:", gameSessionResponse.status, errorMessage);
            setError(`게임 세션을 불러올 수 없습니다: ${errorMessage}`);
            setLoading(false);
            return;
          }

          // 게임이 진행 중이 아닐 때만 전체 블럭 조회 (게임 진행 중이면 게임 세션의 블럭 사용)
          if (!gameSessionData || gameSessionData.status !== "running") {
            // 팀의 획득한 블럭 조회 (team_block_events에서)
            const blocksResponse = await fetch(
              `/api/party/${partyId}/team-blocks?teamId=${currentTeamId}`,
            );
            if (blocksResponse.ok) {
              const blocksResult = await blocksResponse.json();
              console.log("블럭 조회 결과:", blocksResult); // 디버깅용
              if (blocksResult.success && blocksResult.data?.blocks) {
                console.log("블럭 데이터:", blocksResult.data.blocks); // 디버깅용
                // block_type과 BlockColor를 함께 저장
                const blocks: Array<{ type: string; color: BlockColor }> = blocksResult.data.blocks
                  .map(
                    (block: { block_type: string }): { type: string; color: BlockColor } | null => {
                      // block_type을 BlockColor로 매핑
                      const blockTypeMap: Record<string, BlockColor> = {
                        special: "special",
                        S: "red",
                        I: "purple",
                        "L-right": "orange",
                        T: "blue",
                        Z: "green",
                        "L-left": "yellow",
                        O: "pink",
                      };
                      const color = blockTypeMap[block.block_type] || null;
                      if (!color) {
                        console.warn("알 수 없는 블럭 타입:", block.block_type);
                        return null;
                      }
                      return { type: block.block_type, color };
                    },
                  )
                  .filter(
                    (
                      block: { type: string; color: BlockColor } | null,
                    ): block is { type: string; color: BlockColor } => block !== null,
                  ); // null 제거
                console.log("변환된 블럭:", blocks); // 디버깅용
                setRemainingPieces(blocks);
              } else {
                console.warn("블럭 데이터가 없습니다:", blocksResult);
              }
            } else {
              console.error("블럭 조회 실패:", await blocksResponse.text());
            }
          } else {
            // 게임 진행 중이면 게임 세션의 블럭 사용
            if (gameSessionData.current_pieces) {
              // 게임 세션의 블럭이 이미 올바른 형식인지 확인
              const pieces = gameSessionData.current_pieces;
              if (Array.isArray(pieces) && pieces.length > 0) {
                // 첫 번째 블럭이 객체 형식인지 확인
                if (typeof pieces[0] === "object" && "type" in pieces[0] && "color" in pieces[0]) {
                  setRemainingPieces(pieces as Array<{ type: string; color: BlockColor }>);
                } else {
                  // BlockColor[] 형식이면 변환 필요 (하지만 타입 정보가 없으므로 빈 배열로)
                  console.warn("게임 세션의 블럭 형식이 예상과 다릅니다:", pieces);
                  setRemainingPieces([]);
                }
              } else {
                setRemainingPieces([]);
              }
            }
          }
        }
      } catch (error) {
        console.error("데이터 조회 에러:", error);
        setError("데이터를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [partyId, teamId, router]);

  // 파티 정보 로드 후 상태 확인 (디버깅용)
  useEffect(() => {
    if (party) {
      console.log("📊 파티 정보 상태 확인:", {
        id: party.id,
        name: party.name,
        status: party.status,
        isRunning: party.status === "running",
      });
    } else {
      console.log("⚠️ 파티 정보가 아직 로드되지 않았습니다");
    }
  }, [party]);

  // Supabase Realtime 구독: 파티 상태 변경 시 자동 업데이트
  useEffect(() => {
    if (!partyId) return;

    const supabase = createClient();
    if (!supabase) {
      console.error("Supabase 클라이언트 생성 실패");
      return;
    }

    console.log("🔄 파티 상태 Realtime 구독 시작");

    // 파티 상태 변경 감지
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
            console.log("✅ 파티 상태 업데이트:", updatedParty.status);
          }
        },
      )
      .subscribe();

    // cleanup: 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log("🔄 파티 상태 Realtime 구독 해제");
      supabase.removeChannel(partyChannel);
    };
  }, [partyId]);

  // Supabase Realtime 구독: 게임 세션 상태 변경 시 자동 업데이트
  useEffect(() => {
    if (!partyId || !teamId) return;

    const supabase = createClient();
    if (!supabase) {
      console.error("Supabase 클라이언트 생성 실패");
      return;
    }

    console.log("🔄 게임 세션 상태 Realtime 구독 시작");

    // 게임 세션 상태 변경 감지
    const gameSessionChannel = supabase
      .channel(`game_session_${partyId}_${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE 모두 감지
          schema: "public",
          table: "game_sessions",
          filter: `party_id=eq.${partyId} AND team_id=eq.${teamId}`,
        },
        (payload) => {
          console.log("📡 게임 세션 상태 변경 감지:", payload);

          if (payload.eventType === "UPDATE" && payload.new) {
            const updatedSession = payload.new as any;

            // DB 상태 저장 (idle vs inactive 구분용)
            setDbGameStatus(updatedSession.status);

            // 상태 매핑 및 업데이트
            let mappedState: GameState = "inactive";
            if (updatedSession.status === "inactive") {
              mappedState = "inactive";
              console.log("✅ Realtime: inactive (초기 상태)");
            } else if (updatedSession.status === "requesting") {
              mappedState = "requesting";
              console.log("✅ Realtime: requesting (승인 대기 중)");
            } else if (updatedSession.status === "ready") {
              mappedState = "ready";
              setShowStartDialog(true);
              console.log("✅ Realtime: ready (다이얼로그 표시)");
            } else if (updatedSession.status === "running") {
              mappedState = "running";
              console.log("✅ Realtime: running (게임 진행 중)");
            } else if (updatedSession.status === "pending") {
              mappedState = "pending";
              console.log(
                "✅ Realtime: pending (게임 데이터 있음, 팀 삭제됨, 더 이상 사용 불가능)",
              );
            } else if (updatedSession.status === "finished") {
              mappedState = "finished";
              console.log("✅ Realtime: finished (파티 종료, 게임 재시작 불가)");
            } else if (updatedSession.status === "cancelled") {
              mappedState = "finished";
              console.log("✅ Realtime: cancelled -> finished (파티 종료, 게임 재시작 불가)");
            } else if (updatedSession.status === "idle") {
              mappedState = "pending";
              console.log("✅ Realtime: idle -> pending (비활성화)");
            }

            setGameState(mappedState);

            // 보드 상태 복원
            if (updatedSession.board_state) {
              setBoard(updatedSession.board_state);
            }
            if (updatedSession.completed_lines !== undefined) {
              setCompletedLines(updatedSession.completed_lines || 0);
            }
          } else if (payload.eventType === "DELETE") {
            // 게임 세션이 삭제된 경우 (드물게 발생)
            console.log("⚠️ Realtime: 게임 세션이 삭제됨");
            setGameState("inactive");
          }
        },
      )
      .subscribe();

    // cleanup: 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log("🔄 게임 세션 상태 Realtime 구독 해제");
      supabase.removeChannel(gameSessionChannel);
    };
  }, [partyId, teamId]);

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
  const handleRequestGameStart = async () => {
    if (acquiredPieces === 0) {
      alert("게임 대기에 추가된 블럭이 없습니다.");
      return;
    }

    if (!partyId || !teamId) return;

    try {
      // 관리자에게 게임 시작 요청 (status='pending'으로 게임 세션 생성)
      const response = await fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          action: "request", // 팀장이 게임 시작 요청
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setGameState("requesting");
        // 메시지가 있으면 표시 (이미 대기 중인 경우)
        const message =
          result.message || "게임 시작 요청이 전송되었습니다. 관리자 승인을 기다려주세요.";
        if (result.message) {
          alert(message);
        }
      } else {
        alert(result.error || "게임 시작 요청에 실패했습니다");
      }
    } catch (error) {
      console.error("게임 시작 요청 에러:", error);
      alert("게임 시작 요청에 실패했습니다");
    }
  };

  // 게임 요청 취소 (pending 상태에서 취소 버튼 클릭 시)
  const handleCancelGameRequest = async () => {
    if (!partyId || !teamId) return;

    if (!confirm("게임 시작 요청을 취소하시겠습니까?")) {
      return;
    }

    try {
      const response = await fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          action: "cancel", // 게임 요청 취소
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setGameState("inactive");
        alert("게임 시작 요청이 취소되었습니다.");
      } else {
        alert(result.error || "게임 요청 취소에 실패했습니다");
      }
    } catch (error) {
      console.error("게임 요청 취소 에러:", error);
      alert("게임 요청 취소에 실패했습니다");
    }
  };

  // 다이얼로그에서 취소 선택 시 (관리자가 승인한 후 취소)
  const handleDialogCancel = async () => {
    if (!partyId || !teamId) return;

    try {
      const response = await fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          action: "cancel", // 게임 요청 취소 (pending 또는 running 상태 모두 취소 가능)
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setGameState("pending");
        setShowStartDialog(false);
        // alert는 표시하지 않음 (사용자가 직접 취소 버튼을 눌렀으므로)
      } else {
        alert(result.error || "게임 요청 취소에 실패했습니다");
      }
    } catch (error) {
      console.error("게임 요청 취소 에러:", error);
      alert("게임 요청 취소에 실패했습니다");
    }
  };

  // 게임 시작 확인 (스탭이 확인한 경우)
  const handleGameStartConfirmed = useCallback(() => {
    setGameState("ready");
    setShowStartDialog(true);
  }, []);

  // 게임 시작
  const handleStartGame = async () => {
    if (!partyId || !teamId) return;

    try {
      // 게임 세션 생성 (status='running')
      const response = await fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          action: "begin", // 게임 시작
          boardSnapshot: {
            board: board,
            availableBlocks: remainingPieces.map((p) => ({
              id: `${Date.now()}-${Math.random()}`, // 임시 ID
              block_type: p.type,
            })),
          },
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setGameState("running");
        setShowStartDialog(false);
        // 첫 블럭 생성
        if (remainingPieces.length > 0) {
          spawnNextPiece();
        }
      } else {
        alert(result.error || "게임 시작에 실패했습니다");
      }
    } catch (error) {
      console.error("게임 시작 에러:", error);
      alert("게임 시작에 실패했습니다");
    }
  };

  // 다음 블럭 생성
  const spawnNextPiece = useCallback(() => {
    if (remainingPieces.length === 0) {
      setCurrentPiece(null);
      return;
    }

    const nextPieceData = remainingPieces[0];
    if (!nextPieceData) {
      setCurrentPiece(null);
      return;
    }

    const blockType = nextPieceData.type as BlockType;
    const isSpecial = blockType === "special";
    const newPiece = createNewPiece(blockType, 3, 0);

    // remainingPieces에서 첫 번째 블럭 제거
    setRemainingPieces((prev) => prev.slice(1));
    setCurrentPiece(newPiece);
    setIsSpecialBlock(isSpecial);
  }, [remainingPieces]);

  // 블럭 고정 후 처리
  const handlePieceLock = useCallback(
    (lockedPiece: TetrisPiece) => {
      // 1. 블럭을 보드에 고정
      const newBoard = lockPiece(board, lockedPiece);
      setBoard(newBoard);

      // 2. 라인 완성 체크 (제거 없이 카운트만)
      const newCompletedLines = checkCompletedLines(newBoard);
      if (newCompletedLines > completedLines) {
        setCompletedLines(newCompletedLines);
      }

      // 3. 점수 계산 및 업데이트
      const newScore = calculateTetrisScore(newBoard);
      setTeamTotalScore(newScore);

      // 4. 최고 높이 계산 및 특수 블럭 획득 체크
      const currentHeight = calculateHighestHeight(newBoard);
      if (checkSpecialBlockReward(currentHeight, previousHeight)) {
        // 특수 블럭 획득 (5줄마다)
        if (partyId && teamId) {
          fetch(`/api/party/${partyId}/team-blocks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              blockType: "special",
              source: "height_threshold",
            }),
          }).catch((err) => console.error("특수 블럭 획득 API 호출 실패:", err));
        }
        // 특수 블럭을 remainingPieces에 추가
        setRemainingPieces((prev) => [...prev, { type: "special", color: "special" }]);
        setPreviousHeight(currentHeight);
      } else {
        setPreviousHeight(currentHeight);
      }

      // 5. 게임 상태 저장 (비동기로 저장, 에러 무시)
      if (partyId && teamId && gameState === "running") {
        fetch(`/api/party/${partyId}/game-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamId,
            action: "update",
            boardSnapshot: {
              board: newBoard,
              availableBlocks: remainingPieces.map((p) => ({
                id: `${Date.now()}-${Math.random()}`,
                block_type: p.type,
              })),
            },
            totalScore: newScore,
            completedLines: newCompletedLines,
          }),
        }).catch((err) => console.error("게임 상태 저장 실패:", err));
      }

      // 6. 다음 블럭 생성
      setCurrentPiece(null);
      setTimeout(() => {
        spawnNextPiece();
      }, 100);
    },
    [
      board,
      completedLines,
      previousHeight,
      spawnNextPiece,
      remainingPieces,
      gameState,
      partyId,
      teamId,
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

        // 게임 로직 서비스를 사용하여 배치 가능 여부 체크
        if (canPlacePiece(board, prev, dx, dy)) {
          return { ...prev, x: prev.x + dx, y: prev.y + dy };
        }

        // 아래로 이동 시 더 이상 이동 불가능하면 블럭 고정
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
    // 회전 후 배치 가능 여부 체크
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
      // 드랍 후 즉시 고정
      setTimeout(() => {
        const droppedPiece: TetrisPiece = {
          ...currentPiece,
          y: currentPiece.y + dropDistance,
        };
        handlePieceLock(droppedPiece);
      }, 100);
    } else {
      // 이미 바닥에 도달한 경우
      handlePieceLock(currentPiece);
    }
  }, [currentPiece, gameState, isSpecialBlock, board, handlePieceLock]);

  const handleConfirm = useCallback(() => {
    if (!currentPiece || gameState !== "running" || !isSpecialBlock) return;
    // 특수 블럭 확정 - 현재 위치에 고정
    handlePieceLock(currentPiece);
    setIsSpecialBlock(false);
  }, [currentPiece, gameState, isSpecialBlock, handlePieceLock]);

  // 게임 점수 계산
  const calculateGameScore = useCallback((): number => {
    return calculateTetrisScore(board);
  }, [board]);

  // 게임 종료 처리
  const handleFinishGame = useCallback(async () => {
    if (!partyId || !teamId) return;

    try {
      // 게임 세션 업데이트 (finished 상태로)
      const response = await fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          action: "finish",
          boardSnapshot: {
            board: board,
            availableBlocks: remainingPieces.map((p) => ({
              id: `${Date.now()}-${Math.random()}`,
              block_type: p.type,
            })),
          },
          totalScore: calculateGameScore(),
          completedLines,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setGameState("finished");
        // 랭킹 업데이트 큐에 추가
        await fetch(`/api/admin/${partyId}/rankings/calculate`, {
          method: "POST",
        });
      }
    } catch (error) {
      console.error("게임 종료 처리 에러:", error);
    }
  }, [partyId, teamId, board, completedLines, calculateGameScore]);

  // 게임 종료 체크
  useEffect(() => {
    if (gameState === "running" && remainingPieces.length === 0 && !currentPiece) {
      handleFinishGame();
    }
  }, [gameState, remainingPieces, currentPiece, handleFinishGame]);

  // 게임 상태 주기적 저장 (30초마다)
  useEffect(() => {
    if (gameState !== "running" || !partyId || !teamId) return;

    const interval = setInterval(() => {
      fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          action: "update",
          boardSnapshot: {
            board: board,
            availableBlocks: remainingPieces.map((p) => ({
              id: `${Date.now()}-${Math.random()}`,
              block_type: p.type,
            })),
          },
          totalScore: calculateGameScore(),
          completedLines,
        }),
      }).catch((err) => console.error("게임 상태 주기적 저장 실패:", err));
    }, 30000); // 30초마다

    return () => clearInterval(interval);
  }, [gameState, partyId, teamId, board, remainingPieces, completedLines, calculateGameScore]);

  // ⚠️ 폴링 제거됨: Realtime 구독으로 대체됨
  // 게임 세션 상태 변경은 Realtime 구독을 통해 실시간으로 감지됩니다.

  // 팀 랭킹 조회
  useEffect(() => {
    if (!partyId) return;

    const fetchRankings = async () => {
      try {
        const response = await fetch(`/api/party/${partyId}/rankings`);
        const result = await response.json();
        if (response.ok && result.success && result.data?.team) {
          setTeamRankings(result.data.team || []);
        }
      } catch (error) {
        console.error("팀 랭킹 조회 에러:", error);
      }
    };

    fetchRankings();
  }, [partyId]);

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

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header variant="dashboard" partyName={party?.name || "파티"} />
        <main className="flex-1 container max-w-lg mx-auto px-4 py-6">
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <div className="text-red-600 text-sm">{error}</div>
            </CardContent>
          </Card>
        </main>
        <RankboardFooterNavigation partyId={partyId} />
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
        {/* 테트리스 게임 보드 */}
        <div className="space-y-4">
          <TetrisBoard
            board={board}
            currentPiece={currentPiece || undefined}
            specialLines={[5, 10, 15]}
            nextPieces={remainingPieces}
          />

          {/* 게임 시작 버튼 또는 게임 컨트롤 */}
          {gameState === "inactive" || gameState === "pending" || gameState === "finished" ? (
            <div className="flex items-center gap-4">
              {/* 파티가 진행 중일 때만 게임 시작 요청 가능 */}
              {party && party.status === "running" ? (
                <>
                  {dbGameStatus === "pending" ? (
                    <div className="flex-4 text-center text-destructive text-sm py-3">
                      게임 세션이 비활성화되어 있습니다. 팀 관리자에게 문의하세요.
                    </div>
                  ) : isLeader ? (
                    <Button
                      variant="primary"
                      size="lg"
                      className="flex-4 p-0"
                      onClick={handleRequestGameStart}
                      disabled={acquiredPieces === 0}
                    >
                      게임 시작 요청하기
                    </Button>
                  ) : (
                    <div className="flex-4 text-center text-muted-foreground text-sm py-3">
                      팀장만 게임 시작을 요청할 수 있습니다
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-4 text-center text-muted-foreground text-sm py-3">
                  {!party ? (
                    "파티 정보를 불러오는 중..."
                  ) : (
                    <>
                      {gameState === "finished"
                        ? `파티가 종료되어 게임을 다시 시작할 수 없습니다`
                        : gameState === "pending"
                          ? `게임 세션이 비활성화되어 있습니다. 팀 관리자에게 문의하세요.`
                          : `파티가 진행 중이 아닙니다`}
                      <br />
                      <span className="text-xs text-gray-500">
                        (파티 상태: {party.status || "알 수 없음"})
                      </span>
                    </>
                  )}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="flex-1"
                onClick={() => setShowGameRules(!showGameRules)}
                aria-label="게임 규칙 보기"
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          ) : gameState === "requesting" ? (
            <div className="flex items-center gap-4">
              {isLeader && (
                <>
                  <div className="flex-4 text-center text-muted-foreground text-sm py-3">
                    관리자 승인을 기다리는 중...
                  </div>
                  <Button
                    variant="destructive"
                    size="lg"
                    className="flex-1 p-0"
                    onClick={handleCancelGameRequest}
                  >
                    요청 취소
                  </Button>
                </>
              )}
              {!isLeader && (
                <div className="flex-4 text-center text-muted-foreground text-sm py-3">
                  관리자 승인을 기다리는 중입니다
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="flex-1"
                onClick={() => setShowGameRules(!showGameRules)}
                aria-label="게임 규칙 보기"
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          ) : gameState === "ready" ? (
            // ready 상태: 승인 완료, 게임 시작 대기 (다이얼로그 표시)
            <div className="flex items-center gap-4">
              <div className="flex-4 text-center text-muted-foreground text-sm py-3">
                게임 시작 준비가 완료되었습니다. 다이얼로그에서 확인해주세요.
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-1"
                onClick={() => setShowGameRules(!showGameRules)}
                aria-label="게임 규칙 보기"
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          ) : gameState === "running" ? (
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

        {/* 팀 게임 현황 */}
        <TeamGameStatusCard
          teamTotalScore={teamTotalScore}
          completedLines={completedLines}
          acquiredPieces={acquiredPieces}
          timeRemaining={gameState === "running" ? timeRemaining : undefined}
        />

        {/* 실시간 팀 랭킹 */}
        <TeamRanking teams={teamRankings.length > 0 ? teamRankings : []} />
      </main>

      <RankboardFooterNavigation partyId={partyId} />

      {/* 게임 시작 다이얼로그 */}
      <GameStartDialog
        open={showStartDialog}
        onOpenChange={setShowStartDialog}
        onConfirm={handleStartGame}
        onCancel={handleDialogCancel}
      />
    </div>
  );
}
