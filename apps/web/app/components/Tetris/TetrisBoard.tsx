"use client";

import { cn } from "@pkg/ui-web/lib/utils";

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

interface TetrisBoardProps {
  board: BlockColor[][];
  currentPiece?: { x: number; y: number; shape: number[][]; color: BlockColor };
  specialLines?: number[]; // 특수 라인 위치 (y 좌표)
  nextPieces?: BlockColor[]; // 대기 중인 블럭들
}

export function TetrisBoard({
  board,
  currentPiece,
  specialLines = [5, 10, 15],
  nextPieces = [],
}: TetrisBoardProps) {
  // 보드와 현재 조각을 합쳐서 표시
  const displayBoard: (BlockColor | "current")[][] = board.map((row) => [...row]);

  if (currentPiece) {
    currentPiece.shape.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell && currentPiece) {
          const y = currentPiece.y + rowIndex;
          const x = currentPiece.x + colIndex;
          if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
            if (displayBoard[y] && displayBoard[y][x] === null) {
              displayBoard[y]![x] = "current";
            }
          }
        }
      });
    });
  }

  const getBlockColor = (color: BlockColor | "current" | null | undefined): string => {
    // "current"인 경우 currentPiece의 색상으로 변환
    if (color === "current") {
      color = currentPiece?.color || null;
    }

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

    // 이 시점에서 color는 null이 아니고 "current"도 아님
    if (color === null) return "bg-gray-800";
    return colorMap[color] || "bg-gray-800";
  };

  // 테트리스 블럭 모양 정의
  const tetrisShapes: Record<string, number[][]> = {
    I: [
      [1, 1, 1, 1], // 가로
    ],
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
  };

  // 블럭 색상에 따라 모양 할당 (반복 가능하도록 순환)
  const getShapeForColor = (color: BlockColor, index: number): number[][] => {
    if (color === "special" || !color) return [];

    const shapeKeys = Object.keys(tetrisShapes);
    if (shapeKeys.length === 0) return [];

    const shapeKey = shapeKeys[index % shapeKeys.length];
    if (!shapeKey) return [];

    const shape = tetrisShapes[shapeKey];
    return shape || [];
  };

  // 블럭 미리보기 렌더링
  const getBlockPreview = (color: BlockColor | null, index: number) => {
    if (!color) return null;

    if (color === "special") {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-yellow-400 text-2xl">⭐</span>
        </div>
      );
    }

    const shape = getShapeForColor(color, index);
    if (!shape || shape.length === 0) {
      // 폴백: 색상 블럭만 표시
      return <div className={cn("w-full h-full rounded-sm", getBlockColor(color))} />;
    }

    const rows = shape.length;
    const firstRow = shape[0];
    const cols = firstRow?.length || 0;
    if (rows === 0 || cols === 0) {
      return <div className={cn("w-full h-full rounded-sm", getBlockColor(color))} />;
    }
    const cellSize = Math.min(100 / Math.max(rows, cols), 100 / 4); // 최대 4x4로 제한

    return (
      <div className="w-full h-full flex items-center justify-center">
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
                  className={cn("rounded-sm border border-black/20 w-3 h-3", getBlockColor(color))}
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

  return (
    <div className="flex gap-2">
      {/* 게임 보드 */}
      <div className="relative bg-gray-900 rounded-lg p-2 border-2 border-gray-700 flex-5">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)` }}>
          {Array.from({ length: BOARD_HEIGHT }).map((_, rowIndex) =>
            Array.from({ length: BOARD_WIDTH }).map((_, colIndex) => {
              const block = displayBoard[rowIndex]?.[colIndex];
              const isSpecialLine = specialLines.includes(BOARD_HEIGHT - 1 - rowIndex);
              const isCurrent = block === "current";

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    "aspect-square border border-gray-700 rounded-sm",
                    getBlockColor(block),
                    isCurrent && "ring-2 ring-white ring-opacity-50",
                    isSpecialLine && "relative",
                  )}
                >
                  {/* 특수 라인 표시 */}
                  {isSpecialLine && (
                    <div className="absolute inset-0 border-t-2 border-yellow-400 opacity-50 flex items-center justify-end pr-1">
                      {/* <span className="text-xs text-yellow-400 font-bold">특수</span> */}
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* 대기 중인 블럭 영역 */}
      {nextPieces.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 flex-1">
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
            {nextPieces.map((piece, index) => (
              <div
                key={index}
                className={cn(
                  "aspect-square rounded-sm border",
                  "flex items-center justify-center shrink-0 min-h-12",
                )}
              >
                {piece && getBlockPreview(piece, index)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
