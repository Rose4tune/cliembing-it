import type { Meta, StoryObj } from "@storybook/react";
import { TeamGameStatusCard } from "./TeamGameStatusCard";

const meta: Meta<typeof TeamGameStatusCard> = {
  title: "Components/Tetris/TeamGameStatusCard",
  component: TeamGameStatusCard,
  tags: ["autodocs"],
  argTypes: {
    teamTotalScore: { control: "number" },
    completedLines: { control: "number" },
    acquiredPieces: { control: "number" },
    timeRemaining: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof TeamGameStatusCard>;

export const Default: Story = {
  args: {
    teamTotalScore: 0,
    completedLines: 0,
    acquiredPieces: 7,
    timeRemaining: "01:05:12",
  },
};

export const WithScore: Story = {
  args: {
    teamTotalScore: 5,
    completedLines: 1,
    acquiredPieces: 7,
    timeRemaining: "00:45:52",
  },
};

export const NoTimer: Story = {
  args: {
    teamTotalScore: 0,
    completedLines: 0,
    acquiredPieces: 0,
  },
};
