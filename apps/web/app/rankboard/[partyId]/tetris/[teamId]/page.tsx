"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
    Array<{ id: string; type: string; color: BlockColor }>
  >([]);
  const [board, setBoard] = useState<BlockColor[][]>(
    Array(BOARD_HEIGHT)
      .fill(null)
      .map(() => Array(BOARD_WIDTH).fill(null)),
  );
  const [currentPiece, setCurrentPiece] = useState<TetrisPiece | null>(null);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null); // 현재 사용 중인 블럭 ID 추적
  const previousHeightRef = useRef(0); // useRef로 변경하여 동기적 관리
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

            // board_snapshot이 있으면 board와 availableBlocks 복원 (우선순위 높음)
            if (session.board_snapshot) {
              const snapshot = session.board_snapshot as {
                board?: any[][];
                availableBlocks?: Array<{ id: string; block_type: string }> | string[];
              };

              // board 복원
              if (snapshot.board && Array.isArray(snapshot.board)) {
                setBoard(snapshot.board);
                console.log("✅ board_snapshot에서 board 복원 완료");
              }

              // availableBlocks 복원
              if (snapshot.availableBlocks && Array.isArray(snapshot.availableBlocks)) {
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

                // availableBlocks가 객체 배열인지 문자열 배열인지 확인
                const convertedPieces = snapshot.availableBlocks
                  .map(
                    (
                      block: any,
                      index: number,
                    ): { id: string; type: string; color: BlockColor } | null => {
                      // 문자열 배열인 경우 (하위 호환성)
                      if (typeof block === "string") {
                        const color = blockTypeMap[block] || null;
                        if (!color) return null;
                        return {
                          id: `temp-${Date.now()}-${index}`,
                          type: block,
                          color,
                        };
                      }
                      // 객체 배열인 경우
                      if (typeof block === "object" && block !== null) {
                        const blockType = block.block_type || block.type || block;
                        const blockId = block.id || `temp-${Date.now()}-${index}`;
                        const color = blockTypeMap[blockType] || null;
                        if (!color) return null;
                        return {
                          id: blockId,
                          type: blockType,
                          color,
                        };
                      }
                      return null;
                    },
                  )
                  .filter(
                    (
                      block: { id: string; type: string; color: BlockColor } | null,
                    ): block is { id: string; type: string; color: BlockColor } => block !== null,
                  ) as Array<{ id: string; type: string; color: BlockColor }>;

                if (convertedPieces.length > 0) {
                  setRemainingPieces(convertedPieces);
                  console.log(
                    "✅ board_snapshot에서 availableBlocks 복원 완료:",
                    convertedPieces.length,
                    "개",
                  );
                }
              }

              // previousHeight 복원: 게임 세션이 로드될 때 현재 보드의 최고 높이로 설정
              if (session.board_snapshot?.board) {
                const restoredBoard = session.board_snapshot.board as BlockColor[][];
                previousHeightRef.current = calculateHighestHeight(restoredBoard);
              }
            } else if (session.board_state) {
              // 하위 호환성: board_state 사용
              setBoard(session.board_state);
            }

            setCompletedLines(session.completed_lines || 0);

            // 게임 세션의 current_pieces를 remainingPieces로 변환 (board_snapshot이 없을 때만)
            if (
              !session.board_snapshot &&
              session.current_pieces &&
              Array.isArray(session.current_pieces)
            ) {
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

              // current_pieces가 { id, block_type } 형식인지 확인
              const convertedPieces: Array<{ id: string; type: string; color: BlockColor }> =
                session.current_pieces
                  .map((piece: any) => {
                    const blockType =
                      typeof piece === "string" ? piece : piece.block_type || piece.type;
                    const blockId =
                      typeof piece === "object" && "id" in piece
                        ? piece.id
                        : `temp-${Date.now()}-${Math.random()}`;
                    const color = blockTypeMap[blockType] || null;
                    if (!color) return null;
                    return {
                      id: blockId,
                      type: blockType,
                      color,
                    };
                  })
                  .filter(
                    (
                      block: { id: string; type: string; color: BlockColor } | null,
                    ): block is { id: string; type: string; color: BlockColor } => block !== null,
                  );

              setRemainingPieces(convertedPieces);
            }
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

          // 게임 진행 중이 아닐 때: 전체 블럭 조회 (사용 가능한 블럭만)
          // 게임 진행 중일 때: board_snapshot의 availableBlocks 사용, + 새로 승인받은 블럭 추가
          if (!gameSessionData || gameSessionData.status !== "running") {
            // 팀의 획득한 블럭 조회 (team_block_events에서, 사용 가능한 블럭만)
            const blocksResponse = await fetch(
              `/api/party/${partyId}/team-blocks?teamId=${currentTeamId}`,
            );
            if (blocksResponse.ok) {
              const blocksResult = await blocksResponse.json();
              console.log("블럭 조회 결과:", blocksResult); // 디버깅용
              if (blocksResult.success && blocksResult.data?.blocks) {
                console.log("블럭 데이터:", blocksResult.data.blocks); // 디버깅용
                // block_type과 BlockColor를 함께 저장 (id 포함)
                // 이미 개별 레코드이므로 ID 그대로 사용
                const blocks: Array<{ id: string; type: string; color: BlockColor }> =
                  blocksResult.data.blocks
                    .map(
                      (block: {
                        id: string;
                        block_type: string;
                      }): { id: string; type: string; color: BlockColor } | null => {
                        // 이미 실제 team_block_events.id이므로 그대로 사용
                        const actualId = block.id;
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
                        return { id: actualId, type: block.block_type || "", color };
                      },
                    )
                    .filter(
                      (
                        block: { id: string; type: string; color: BlockColor } | null,
                      ): block is { id: string; type: string; color: BlockColor } => block !== null,
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
            // 게임 진행 중: board_snapshot에서 복원된 블럭 사용
            // + 새로 승인받은 블럭 추가 (게임 중에도 새 블럭 획득 가능)
            // board_snapshot이 없거나 availableBlocks가 없으면 새로 조회
            if (
              !gameSessionData.board_snapshot?.availableBlocks ||
              (Array.isArray(gameSessionData.board_snapshot.availableBlocks) &&
                gameSessionData.board_snapshot.availableBlocks.length === 0)
            ) {
              // board_snapshot에 블럭이 없으면 전체 블럭 조회
              const blocksResponse = await fetch(
                `/api/party/${partyId}/team-blocks?teamId=${currentTeamId}`,
              );
              if (blocksResponse.ok) {
                const blocksResult = await blocksResponse.json();
                if (blocksResult.success && blocksResult.data?.blocks) {
                  const blocks: Array<{ id: string; type: string; color: BlockColor }> =
                    blocksResult.data.blocks
                      .map(
                        (block: {
                          id: string;
                          block_type: string;
                        }): { id: string; type: string; color: BlockColor } | null => {
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
                          if (!color) return null;
                          return { id: block.id, type: block.block_type || "", color };
                        },
                      )
                      .filter(
                        (
                          block: { id: string; type: string; color: BlockColor } | null,
                        ): block is { id: string; type: string; color: BlockColor } =>
                          block !== null,
                      );
                  setRemainingPieces(blocks);
                  console.log("✅ 게임 진행 중: 블럭 조회 완료:", blocks.length, "개");
                }
              }
            } else {
              // board_snapshot에서 복원된 블럭이 있으면, 새로 승인받은 블럭만 추가
              const blocksResponse = await fetch(
                `/api/party/${partyId}/team-blocks?teamId=${currentTeamId}`,
              );
              if (blocksResponse.ok) {
                const blocksResult = await blocksResponse.json();
                if (blocksResult.success && blocksResult.data?.blocks) {
                  const newBlocks: Array<{ id: string; type: string; color: BlockColor }> =
                    blocksResult.data.blocks
                      .map(
                        (block: {
                          id: string;
                          block_type: string;
                        }): { id: string; type: string; color: BlockColor } | null => {
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
                          if (!color) return null;
                          return { id: block.id, type: block.block_type || "", color };
                        },
                      )
                      .filter(
                        (
                          block: { id: string; type: string; color: BlockColor } | null,
                        ): block is { id: string; type: string; color: BlockColor } =>
                          block !== null,
                      );

                  // 기존 remainingPieces와 새 블럭 합치기 (중복 제거)
                  setRemainingPieces((prev) => {
                    const existingIds = new Set(prev.map((p) => p.id));
                    const uniqueNewBlocks = newBlocks.filter((b) => !existingIds.has(b.id));
                    if (uniqueNewBlocks.length > 0) {
                      console.log("✅ 새로 승인받은 블럭 추가:", uniqueNewBlocks.length, "개");
                    }
                    return [...prev, ...uniqueNewBlocks];
                  });
                }
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
      // 게임 세션 상태 업데이트 (ready → running)
      // 주의: 게임 세션은 팀 생성 시 자동으로 생성되며, 여기서는 기존 세션의 상태만 업데이트
      const response = await fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamId,
          action: "begin", // 게임 시작: ready 상태의 세션을 running으로 변경
          boardSnapshot: {
            board: board,
            availableBlocks: remainingPieces.map((p) => ({
              id: p.id,
              block_type: p.type,
            })),
          },
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setGameState("running");
        setShowStartDialog(false);

        // API 응답에서 availableBlocks 가져와서 remainingPieces 설정
        if (result.data?.board_snapshot?.availableBlocks) {
          const availableBlocks = result.data.board_snapshot.availableBlocks;
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

          const convertedPieces: Array<{ id: string; type: string; color: BlockColor }> =
            availableBlocks
              .map((block: { id: string; block_type: string }) => {
                // 이미 실제 team_block_events.id이므로 그대로 사용
                const actualId = block.id;
                const color = blockTypeMap[block.block_type] || null;
                if (!color) return null;
                return {
                  id: actualId,
                  type: block.block_type,
                  color,
                };
              })
              .filter(
                (
                  block: { id: string; type: string; color: BlockColor } | null,
                ): block is { id: string; type: string; color: BlockColor } => block !== null,
              );

          setRemainingPieces(convertedPieces);

          // 첫 블럭 생성
          if (convertedPieces.length > 0) {
            setTimeout(() => {
              spawnNextPiece();
            }, 100);
          }
        } else if (remainingPieces.length > 0) {
          // API 응답에 availableBlocks가 없으면 기존 remainingPieces 사용
          setTimeout(() => {
            spawnNextPiece();
          }, 100);
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
      setCurrentBlockId(null);
      return;
    }

    const nextPieceData = remainingPieces[0];
    if (!nextPieceData) {
      setCurrentPiece(null);
      setCurrentBlockId(null);
      return;
    }

    const blockType = nextPieceData.type as BlockType;
    const isSpecial = blockType === "special";
    const newPiece = createNewPiece(blockType, 3, 0);

    // 현재 사용 중인 블럭 ID 저장 (블럭 고정 시 소비하기 위해)
    setCurrentBlockId(nextPieceData.id);
    setCurrentPiece(newPiece);
    setIsSpecialBlock(isSpecial);
  }, [remainingPieces]);

  // 블럭 고정 후 처리
  const handlePieceLock = useCallback(
    async (lockedPiece: TetrisPiece) => {
      // 1. 블럭을 보드에 고정
      const newBoard = lockPiece(board, lockedPiece);
      setBoard(newBoard);

      // 2. 라인 완성 체크 (제거 없이 카운트만)
      const newCompletedLines = checkCompletedLines(newBoard);
      const linesCompleted = newCompletedLines > completedLines;
      if (linesCompleted) {
        setCompletedLines(newCompletedLines);
      }

      // 3. 점수 계산 및 업데이트
      // 라인 완성 시점 또는 게임 일단락 시점에 점수 계산
      const newScore = calculateTetrisScore(newBoard);
      setTeamTotalScore(newScore);

      // 4. 블럭 소비 처리 (currentBlockId 사용 - spawnNextPiece에서 설정됨)
      if (currentBlockId && partyId && teamId && gameState === "running") {
        // 임시 ID 블럭은 소비하지 않음 (DB에 존재하지 않음)
        if (currentBlockId.startsWith("temp-") || currentBlockId.startsWith("special-")) {
          console.warn("임시 ID 블럭은 소비하지 않습니다:", currentBlockId);
          // 임시 ID 블럭은 remainingPieces에서만 제거
          setRemainingPieces((prev) => prev.filter((p) => p.id !== currentBlockId));
          setCurrentBlockId(null);
        } else {
          try {
            const consumeResponse = await fetch(`/api/party/${partyId}/game-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                teamId,
                action: "consume_block",
                blockEventId: currentBlockId,
              }),
            });

            const consumeResult = await consumeResponse.json().catch(() => null);

            if (consumeResponse.ok && consumeResult?.success) {
              // 블럭 소비 성공: remainingPieces에서 제거하고 currentBlockId 초기화
              setRemainingPieces((prev) => {
                const updated = prev.filter((p) => p.id !== currentBlockId);

                // 블럭 소비 성공 후 게임 상태 저장 (availableBlocks 업데이트)
                if (partyId && teamId && gameState === "running") {
                  fetch(`/api/party/${partyId}/game-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      teamId,
                      action: "update",
                      boardSnapshot: {
                        board: newBoard,
                        availableBlocks: updated.map((p) => ({
                          id: p.id,
                          block_type: p.type,
                        })),
                      },
                      totalScore: newScore,
                      completedLines: newCompletedLines,
                    }),
                  }).catch((err) => console.error("게임 상태 저장 실패:", err));
                }

                // 남은 블럭이 0개이고 다음 블럭도 없으면 게임 세션을 pending으로 변경
                if (updated.length === 0 && partyId && teamId) {
                  // 블럭이 모두 소진되었으므로 게임 세션을 pending으로 변경 (파티 진행 중이면)
                  fetch(`/api/party/${partyId}/game-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      teamId,
                      action: "finish", // finish 액션이 파티 상태에 따라 pending 또는 finished로 변경
                      boardSnapshot: {
                        board: newBoard,
                        availableBlocks: [],
                      },
                      totalScore: newScore,
                      completedLines: newCompletedLines,
                    }),
                  })
                    .then(async (response) => {
                      if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                          // API에서 파티 상태를 확인하여 pending 또는 finished로 설정됨
                          const sessionStatus = result.data?.status;
                          if (sessionStatus === "pending") {
                            setGameState("pending");
                            console.log("✅ 블럭 모두 소진: 게임 세션 상태 pending으로 변경 완료");
                          } else if (sessionStatus === "finished") {
                            setGameState("finished");
                            // 랭킹 업데이트
                            fetch(`/api/admin/${partyId}/rankings/calculate`, {
                              method: "POST",
                            }).catch((err) => console.error("랭킹 계산 실패:", err));
                            console.log("✅ 블럭 모두 소진: 게임 세션 상태 finished로 변경 완료");
                          }
                        }
                      } else {
                        console.error("게임 세션 상태 변경 실패:", await response.text());
                      }
                    })
                    .catch((err) => console.error("게임 세션 상태 변경 에러:", err));
                }
                return updated;
              });
              setCurrentBlockId(null);
            } else {
              // 블럭 소비 실패: 에러 로그만 남기고 remainingPieces 유지 (소비 재시도 가능)
              const errorText = consumeResult?.error || "알 수 없는 오류";
              console.error("❌ 블럭 소비 실패 (블럭 유지):", {
                blockEventId: currentBlockId,
                status: consumeResponse.status,
                error: errorText,
              });
              // remainingPieces는 유지하고 currentBlockId도 유지 (재시도 가능)
              // 실패한 블럭을 다시 소비하려고 시도할 수 있도록 함
            }
          } catch (err) {
            console.error("블럭 소비 API 호출 실패 (블럭 유지):", err);
            // 네트워크 에러 등: remainingPieces 유지, 재시도 가능
          }
        }
      } else if (!currentBlockId && remainingPieces.length > 0) {
        // currentBlockId가 없는데 remainingPieces가 있으면 로그만 남김 (비정상 상태)
        console.warn(
          "⚠️ 블럭 소비 시도했지만 currentBlockId가 없습니다. remainingPieces:",
          remainingPieces.length,
        );
      }

      // 5. 최고 높이 계산 및 특수 블럭 획득 체크
      // 자동 하강 중에는 특수 블럭을 생성하지 않음 (블럭이 고정될 때만 체크)
      const currentHeight = calculateHighestHeight(newBoard);
      const previousHeight = previousHeightRef.current;
      // 블럭이 고정된 후에만 특수 블럭 체크 (자동 하강 중이 아닐 때)
      if (checkSpecialBlockReward(currentHeight, previousHeight)) {
        // previousHeight를 즉시 업데이트하여 중복 체크 방지
        previousHeightRef.current = currentHeight;
        // 특수 블럭 획득 (특수 라인 통과 시)
        if (partyId && teamId) {
          fetch(`/api/party/${partyId}/team-blocks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              blockType: "special",
              source: "height_threshold",
            }),
          })
            .then(async (response) => {
              if (response.ok) {
                const result = await response.json();
                // API 응답에서 실제 블럭 ID 가져오기
                if (result.success && result.data?.blockId) {
                  setRemainingPieces((prev) => [
                    ...prev,
                    { id: result.data.blockId, type: "special", color: "special" },
                  ]);
                } else {
                  // 블럭 ID가 없으면 블럭을 추가하지 않음 (에러만 로그)
                  console.error("특수 블럭 ID를 받지 못했습니다. 블럭을 추가하지 않습니다.");
                }
              } else {
                console.error("특수 블럭 획득 실패:", await response.text());
              }
            })
            .catch((err) => console.error("특수 블럭 획득 API 호출 실패:", err));
        }
      } else {
        // 특수 블럭 획득하지 않아도 previousHeight 업데이트
        previousHeightRef.current = currentHeight;
      }

      // 6. 다음 블럭 생성 (블럭 소비 성공 후 availableBlocks는 이미 저장됨)
      setCurrentPiece(null);
      setTimeout(() => {
        spawnNextPiece();
      }, 100);
    },
    [
      board,
      completedLines,
      spawnNextPiece,
      remainingPieces,
      gameState,
      partyId,
      teamId,
      currentBlockId,
      currentPiece,
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
        // API에서 파티 상태에 따라 pending 또는 finished로 설정됨
        // API 응답의 status를 확인하여 게임 상태 설정
        const sessionStatus = result.data?.status;
        if (sessionStatus === "pending") {
          setGameState("pending");
        } else if (sessionStatus === "finished") {
          setGameState("finished");
          // 랭킹 업데이트 큐에 추가
          await fetch(`/api/admin/${partyId}/rankings/calculate`, {
            method: "POST",
          });
        } else {
          // 기본값은 finished로 설정
          setGameState("finished");
        }
      }
    } catch (error) {
      console.error("게임 종료 처리 에러:", error);
    }
  }, [partyId, teamId, board, completedLines, calculateGameScore]);

  // 게임 종료 체크 (블럭 소비 후 즉시 처리하므로 이 체크는 보조용)
  // 주로 블럭 소비 로직에서 처리되지만, 다른 경로로 블럭이 모두 소진될 수 있으므로 유지
  useEffect(() => {
    if (gameState === "running" && remainingPieces.length === 0 && !currentPiece) {
      // 블럭 소비 로직에서 이미 처리했을 수 있으므로 짧은 딜레이 후 확인
      const timer = setTimeout(() => {
        handleFinishGame();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [gameState, remainingPieces, currentPiece, handleFinishGame]);

  // 키보드 입력 처리
  useEffect(() => {
    if (gameState !== "running") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentPiece) return;

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
            handleConfirm();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    gameState,
    currentPiece,
    isSpecialBlock,
    handleMove,
    handleRotate,
    handleDrop,
    handleConfirm,
  ]);

  // 블럭 자동 하강 (바닥까지 20칸을 5초에 떨어지도록: 250ms마다 1칸씩)
  useEffect(() => {
    if (gameState !== "running" || isSpecialBlock) return;

    const interval = setInterval(() => {
      // currentPiece가 있으면 자동 하강
      setCurrentPiece((prev) => {
        if (!prev) return null;

        // 아래로 이동 가능한지 체크 (board는 closure로 참조)
        if (canPlacePiece(board, prev, 0, 1)) {
          // 1칸만 이동
          return { ...prev, y: prev.y + 1 };
        } else {
          // 이동 불가 시 자동 고정
          handlePieceLock(prev);
          return null;
        }
      });
    }, 250); // 250ms마다 1칸씩 (바닥까지 20칸 = 5초)

    return () => clearInterval(interval);
  }, [gameState, isSpecialBlock, board, handlePieceLock]);

  // 게임 상태 주기적 저장 (30초마다)
  // useRef를 사용하여 최신 값들을 참조하도록 함 (dependency array 최소화)
  const boardRef = useRef(board);
  const remainingPiecesRef = useRef(remainingPieces);
  const completedLinesRef = useRef(completedLines);
  const calculateGameScoreRef = useRef(calculateGameScore);

  // ref 업데이트
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  useEffect(() => {
    remainingPiecesRef.current = remainingPieces;
  }, [remainingPieces]);
  useEffect(() => {
    completedLinesRef.current = completedLines;
  }, [completedLines]);
  useEffect(() => {
    calculateGameScoreRef.current = calculateGameScore;
  }, [calculateGameScore]);

  useEffect(() => {
    if (gameState !== "running" || !partyId || !teamId) return;

    const interval = setInterval(() => {
      // 최신 값들을 ref에서 가져옴
      const currentBoard = boardRef.current;
      const currentRemainingPieces = remainingPiecesRef.current;
      const currentCompletedLines = completedLinesRef.current;
      const currentCalculateGameScore = calculateGameScoreRef.current;

      fetch(`/api/party/${partyId}/game-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          action: "update",
          boardSnapshot: {
            board: currentBoard,
            availableBlocks: currentRemainingPieces.map((p) => ({
              id: p.id,
              block_type: p.type,
            })),
          },
          totalScore: currentCalculateGameScore(),
          completedLines: currentCompletedLines,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "알 수 없는 오류" }));
            // 404 에러는 로그를 남기지 않음 (게임 세션이 없는 경우)
            if (response.status !== 404) {
              console.error("게임 상태 주기적 저장 실패:", response.status, errorData.error);
            }
          }
        })
        .catch((err) => {
          // 네트워크 에러 등만 로그
          console.error("게임 상태 주기적 저장 에러:", err);
        });
    }, 30000); // 30초마다

    return () => clearInterval(interval);
  }, [gameState, partyId, teamId]); // dependency array 최소화

  // ⚠️ 폴링 제거됨: Realtime 구독으로 대체됨
  // 게임 세션 상태 변경은 Realtime 구독을 통해 실시간으로 감지됩니다.

  // 팀 랭킹 조회
  const fetchRankings = useCallback(async () => {
    if (!partyId) return;

    try {
      const response = await fetch(`/api/party/${partyId}/rankings`);
      const result = await response.json();
      if (response.ok && result.success && result.data?.team) {
        setTeamRankings(result.data.team || []);
      }
    } catch (error) {
      console.error("팀 랭킹 조회 에러:", error);
    }
  }, [partyId]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // 실시간 랭킹 업데이트 구독
  useEffect(() => {
    if (!partyId) return;

    const supabase = createClient();

    // rankings 테이블 구독
    const rankingsChannel = supabase
      .channel(`rankings_${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rankings",
          filter: `party_id=eq.${partyId} AND type=eq.team`,
        },
        (payload) => {
          console.log("📡 랭킹 변경 감지:", payload);
          // 랭킹 재조회
          fetchRankings();
        },
      )
      .subscribe();

    // game_sessions 테이블 구독 (다른 팀의 점수 변경 감지)
    const gameSessionsChannel = supabase
      .channel(`game_sessions_rankings_${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `party_id=eq.${partyId}`,
        },
        (payload) => {
          console.log("📡 게임 세션 점수 변경 감지:", payload);
          // 랭킹 재조회
          fetchRankings();
        },
      )
      .subscribe();

    // team_block_usage 테이블 구독 (블럭 사용 수 변경 감지)
    const blockUsageChannel = supabase
      .channel(`team_block_usage_${partyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_block_usage",
        },
        (payload) => {
          console.log("📡 블럭 사용 변경 감지:", payload);
          // 랭킹 재조회
          fetchRankings();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rankingsChannel);
      supabase.removeChannel(gameSessionsChannel);
      supabase.removeChannel(blockUsageChannel);
    };
  }, [partyId, fetchRankings]);

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
            specialLines={[4, 9, 14, 19]}
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
