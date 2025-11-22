import type { Meta, StoryObj } from "@storybook/react";
import { TeamRanking } from "./TeamRanking";

const meta: Meta<typeof TeamRanking> = {
  title: "Components/Tetris/TeamRanking",
  component: TeamRanking,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TeamRanking>;

const mockTeams = [
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

export const Default: Story = {
  args: {
    teams: mockTeams,
  },
};
