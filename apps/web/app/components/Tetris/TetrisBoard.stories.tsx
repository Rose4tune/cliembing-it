import type { Meta, StoryObj } from "@storybook/react";
import { TetrisBoard } from "./TetrisBoard";

const meta: Meta<typeof TetrisBoard> = {
  title: "Components/Tetris/TetrisBoard",
  component: TetrisBoard,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TetrisBoard>;

const emptyBoard = Array(20)
  .fill(null)
  .map(() => Array(10).fill(null));

const boardWithBlocks = Array(20)
  .fill(null)
  .map((_, rowIndex) =>
    Array(10)
      .fill(null)
      .map((_, colIndex) => {
        // 아래쪽 일부 블록 표시
        if (rowIndex >= 15) {
          const colors: Array<"blue" | "red" | "green" | "purple" | "orange" | "pink" | "yellow"> =
            ["blue", "red", "green", "purple", "orange", "pink", "yellow"];
          return colors[(colIndex + rowIndex) % colors.length];
        }
        return null;
      }),
  );

const currentPiece = {
  x: 3,
  y: 0,
  shape: [
    [1, 1],
    [1, 1],
  ],
  color: "blue" as const,
};

export const Empty: Story = {
  args: {
    board: emptyBoard,
    specialLines: [5, 10, 15],
  },
};

export const WithBlocks: Story = {
  args: {
    board: boardWithBlocks,
    specialLines: [5, 10, 15],
  },
};

export const WithCurrentPiece: Story = {
  args: {
    board: emptyBoard,
    currentPiece,
    specialLines: [5, 10, 15],
  },
};
