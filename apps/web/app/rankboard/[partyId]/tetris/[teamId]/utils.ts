/**
 * 테트리스 게임 관련 유틸리티 함수
 */

export type BlockColor =
  | "blue"
  | "red"
  | "green"
  | "purple"
  | "orange"
  | "pink"
  | "yellow"
  | "special"
  | null;

export type GameState = "inactive" | "pending" | "requesting" | "ready" | "running" | "finished";
export type DbGameStatus =
  | "inactive"
  | "idle"
  | "pending"
  | "requesting"
  | "ready"
  | "running"
  | "finished"
  | "cancelled";

/**
 * 블럭 타입을 BlockColor로 매핑
 */
export const BLOCK_TYPE_TO_COLOR_MAP: Record<string, BlockColor> = {
  special: "special",
  S: "red",
  I: "purple",
  "L-right": "orange",
  T: "blue",
  Z: "green",
  "L-left": "yellow",
  O: "pink",
};

/**
 * 블럭 타입을 색상으로 변환
 */
export function getBlockColor(blockType: string): BlockColor {
  return BLOCK_TYPE_TO_COLOR_MAP[blockType] || null;
}

/**
 * DB 게임 상태를 프론트엔드 GameState로 매핑
 */
export function mapDbStatusToGameState(dbStatus: DbGameStatus): GameState {
  switch (dbStatus) {
    case "inactive":
      return "inactive";
    case "requesting":
      return "requesting";
    case "ready":
      return "ready";
    case "running":
      return "running";
    case "pending":
      return "pending";
    case "finished":
    case "cancelled":
      return "finished";
    case "idle":
      // idle: 비활성화 상태 (팀 삭제 등) - pending으로 매핑하여 게임 재요청 가능하게 함
      return "pending";
    default:
      return "inactive";
  }
}

/**
 * 블럭 데이터를 표준 형식으로 변환
 */
export interface BlockPiece {
  id: string;
  type: string;
  color: BlockColor;
}

/**
 * 다양한 형식의 블럭 데이터를 표준 형식으로 변환
 * - 문자열 배열: ["S", "I", "T"]
 * - 객체 배열: [{ id: "xxx", block_type: "S" }, { id: "yyy", type: "I" }]
 */
export function convertBlocksToPieces(
  blocks: any[],
  generateId: (index: number) => string = (index) => `temp-${Date.now()}-${index}`,
): BlockPiece[] {
  return blocks
    .map((block, index): BlockPiece | null => {
      // 문자열 배열인 경우 (하위 호환성)
      if (typeof block === "string") {
        const color = getBlockColor(block);
        if (!color) return null;
        return {
          id: generateId(index),
          type: block,
          color,
        };
      }

      // 객체 배열인 경우
      if (typeof block === "object" && block !== null) {
        const blockType = block.block_type || block.type || block;
        const blockId = block.id || generateId(index);
        const color = getBlockColor(blockType);
        if (!color) return null;
        return {
          id: blockId,
          type: blockType,
          color,
        };
      }

      return null;
    })
    .filter((block): block is BlockPiece => block !== null);
}

/**
 * team_block_events 형식의 블럭을 BlockPiece로 변환
 */
export function convertTeamBlocksToPieces(
  blocks: Array<{ id: string; block_type: string }>,
): BlockPiece[] {
  return blocks
    .map((block): BlockPiece | null => {
      const color = getBlockColor(block.block_type);
      if (!color) {
        console.warn("알 수 없는 블럭 타입:", block.block_type);
        return null;
      }
      return {
        id: block.id,
        type: block.block_type,
        color,
      };
    })
    .filter((block): block is BlockPiece => block !== null);
}
