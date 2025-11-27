import type { Meta, StoryObj } from "@storybook/react";
import { LoginRequiredCard } from "./LoginRequiredCard";

const meta: Meta<typeof LoginRequiredCard> = {
  title: "Components/PartyCards/LoginRequiredCard",
  component: LoginRequiredCard,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof LoginRequiredCard>;

export const Default: Story = {};
