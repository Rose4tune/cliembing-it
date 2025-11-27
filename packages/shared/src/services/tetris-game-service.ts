/**
 * 테트리스 게임 로직 서비스
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

export type BlockType =
  | "T"
  | "O"
  | "I"
  | "S"
  | "Z"
  | "L-left"
  | "L-right"
  | "special";

// 테트리스 블럭 모양 정의
export const TETRIS_SHAPES: Record<string, number[][]> = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  special: [
    [1], // 특수 블럭은 1x1 크기
  ],
};

// 블럭 타입 이름 매핑
export const BLOCK_TYPE_MAP: Record<string, string> = {
  T: "T",
  O: "O",
  I: "I",
  S: "S",
  Z: "Z",
  "L-left": "L",
  "L-right": "J",
  special: "special",
};

export interface TetrisPiece {
  x: number;
  y: number;
  shape: number[][];
  color: BlockColor;
  type: BlockType;
}

export interface GameState {
  board: BlockColor[][];
  currentPiece: TetrisPiece | null;
  score: number;
  completedLines: number;
  highestHeight: number;
}

/**
 * 블럭 타입으로부터 모양 가져오기
 */
export function getShapeForBlockType(blockType: BlockType): number[][] {
  if (blockType === "special") {
    return TETRIS_SHAPES["special"] || [[1]];
  }
  const shapeKey = BLOCK_TYPE_MAP[blockType];
  if (!shapeKey) return [];
  return TETRIS_SHAPES[shapeKey] || [];
}

/**
 * 블럭 타입으로부터 색상 가져오기
 */
export function getColorForBlockType(blockType: BlockType): BlockColor {
  const colorMap: Record<BlockType, BlockColor> = {
    T: "blue",
    O: "pink",
    I: "purple",
    S: "red",
    Z: "green",
    "L-left": "yellow",
    "L-right": "orange",
    special: "special",
  };
  return colorMap[blockType] || null;
}

/**
 * 보드에 블럭이 배치 가능한지 체크
 * @param board 게임 보드
 * @param piece 블럭
 * @param dx x 방향 이동 거리
 * @param dy y 방향 이동 거리
 * @param rotatedShape 회전된 모양 (선택적)
 * @param checkOnlyFinalPosition true면 최종 위치만 체크 (특수 블럭 확정 시 사용)
 */
export function canPlacePiece(
  board: BlockColor[][],
  piece: TetrisPiece,
  dx: number = 0,
  dy: number = 0,
  rotatedShape?: number[][],
  checkOnlyFinalPosition: boolean = false,
): boolean {
  const shape = rotatedShape || piece.shape;
  const newX = piece.x + dx;
  const newY = piece.y + dy;
  const isSpecial = piece.color === "special";

  // 보드 범위 체크
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row]!.length; col++) {
      if (shape[row]![col]) {
        const boardX = newX + col;
        const boardY = newY + row;

        // 보드 범위 밖
        if (boardX < 0 || boardX >= 10 || boardY < 0 || boardY >= 20) {
          return false;
        }

        // 특수 블럭의 경우: 이동 경로에서는 다른 블럭을 지나갈 수 있음
        // 하지만 최종 위치는 빈 칸이어야 함
        if (isSpecial) {
          if (checkOnlyFinalPosition) {
            // 최종 위치 체크: 빈 칸이어야 함
            if (board[boardY]?.[boardX]) {
              return false;
            }
          } else {
            // 이동 경로 체크: 특수 블럭은 다른 블럭이 있어도 지나갈 수 있음
            // dx, dy가 0이 아니면 이동 중이므로 경로 체크 완화
            // dx, dy가 0이면 최종 위치 체크: 빈 칸이어야 함
            if (dx === 0 && dy === 0) {
              // 최종 위치: 빈 칸이어야 함
              if (board[boardY]?.[boardX]) {
                return false;
              }
            }
            // 이동 중 (dx !== 0 || dy !== 0): 다른 블럭이 있어도 지나갈 수 있음 (체크하지 않음)
          }
        } else {
          // 일반 블럭: 이미 블럭이 있는 곳이면 불가
          if (board[boardY]?.[boardX]) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

/**
 * 블럭 회전 (90도 시계 방향)
 */
export function rotatePiece(shape: number[][]): number[][] {
  if (shape.length === 0) return shape;

  const rows = shape.length;
  const cols = shape[0]?.length || 0;

  // 시계 방향 90도 회전: (row, col) -> (col, rows-1-row)
  const rotated: number[][] = [];
  for (let col = 0; col < cols; col++) {
    const newRow: number[] = [];
    for (let row = rows - 1; row >= 0; row--) {
      newRow.push(shape[row]![col] || 0);
    }
    rotated.push(newRow);
  }

  return rotated;
}

/**
 * 블럭을 보드에 고정
 */
export function lockPiece(
  board: BlockColor[][],
  piece: TetrisPiece,
): BlockColor[][] {
  const newBoard = board.map((row) => [...row]);

  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        const boardX = piece.x + colIndex;
        const boardY = piece.y + rowIndex;

        if (boardX >= 0 && boardX < 10 && boardY >= 0 && boardY < 20) {
          newBoard[boardY]![boardX] = piece.color;
        }
      }
    });
  });

  return newBoard;
}

/**
 * 라인 완성 체크 (제거하지 않고 카운트만)
 */
export function checkCompletedLines(board: BlockColor[][]): number {
  let completedCount = 0;

  for (let row = 0; row < board.length; row++) {
    const isCompleted = board[row]!.every((cell) => cell !== null);
    if (isCompleted) {
      completedCount++;
    }
  }

  return completedCount;
}

/**
 * 보드의 최고 높이 계산 (블럭이 배치된 최대 높이)
 */
export function calculateHighestHeight(board: BlockColor[][]): number {
  for (let row = 0; row < board.length; row++) {
    const hasBlock = board[row]!.some((cell) => cell !== null);
    if (hasBlock) {
      return board.length - row; // 맨 아래가 높이 1
    }
  }
  return 0;
}

/**
 * 라인별 색깔 수 계산
 */
export function countColorsInLine(line: BlockColor[]): number {
  const colorSet = new Set<BlockColor>();
  line.forEach((cell) => {
    if (cell && cell !== "special") {
      colorSet.add(cell);
    }
  });
  return colorSet.size;
}

/**
 * 점수 계산 (라인별 색깔 수 기준)
 */
export function calculateScore(board: BlockColor[][]): number {
  let totalScore = 0;

  // 각 라인별로 색깔 수 계산
  for (const line of board) {
    const colorCount = countColorsInLine(line);
    if (colorCount === 0) continue;

    // 점수 규칙
    const scoreMap: Record<number, number> = {
      8: 20,
      7: 15,
      6: 12,
      5: 9,
      4: 7,
      3: 5,
      2: 3,
      1: 1,
    };

    totalScore += scoreMap[colorCount] || 0;
  }

  return totalScore;
}

/**
 * 특수 블럭 획득 조건 체크 (특수 라인 통과 시에만)
 * 특수 라인: 높이 5, 10, 15, 20 (보드 인덱스: 4, 9, 14, 19)
 */
export function checkSpecialBlockReward(
  currentHeight: number,
  previousHeight: number,
): boolean {
  // 특수 라인 위치 (높이 기준, 맨 아래가 높이 1)
  const specialLineHeights = [5, 10, 15, 20];

  // 현재 높이가 특수 라인을 넘었는지 체크 (이전 높이 < 특수 라인 <= 현재 높이)
  for (const specialHeight of specialLineHeights) {
    if (previousHeight < specialHeight && currentHeight >= specialHeight) {
      return true;
    }
  }

  return false;
}

/**
 * 블럭 드랍 (가장 아래로 이동)
 */
export function dropPiece(
  board: BlockColor[][],
  piece: TetrisPiece,
  isSpecial: boolean = false,
): number {
  if (isSpecial) {
    // 특수 블럭은 드랍하지 않음
    return 0;
  }

  let dropDistance = 0;

  // 아래로 한 칸씩 이동하며 배치 가능한 위치 찾기
  while (canPlacePiece(board, piece, 0, dropDistance + 1)) {
    dropDistance++;
  }

  return dropDistance;
}

/**
 * 새 블럭 생성
 */
export function createNewPiece(
  blockType: BlockType,
  startX: number = 3,
  startY: number = 0,
): TetrisPiece {
  const shape = getShapeForBlockType(blockType);
  const color = getColorForBlockType(blockType);

  return {
    x: startX,
    y: startY,
    shape,
    color,
    type: blockType,
  };
}
