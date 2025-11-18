import type { Meta, StoryObj } from "@storybook/react";
import { GamePreviewCard } from "./GamePreviewCard";

const meta: Meta<typeof GamePreviewCard> = {
  title: "Components/PartyCards/GamePreviewCard",
  component: GamePreviewCard,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof GamePreviewCard>;

export const Default: Story = {};
