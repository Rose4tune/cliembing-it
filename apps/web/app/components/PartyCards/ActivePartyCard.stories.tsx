import type { Meta, StoryObj } from "@storybook/react";
import { ActivePartyCard } from "./ActivePartyCard";

const meta: Meta<typeof ActivePartyCard> = {
  title: "Components/PartyCards/ActivePartyCard",
  component: ActivePartyCard,
  tags: ["autodocs"],
  argTypes: {
    partyName: { control: "text" },
    teamName: { control: "text" },
    onViewDashboard: { action: "dashboard-viewed" },
  },
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActivePartyCard>;

export const Default: Story = {
  args: {
    partyName: "vol.4 테트리스",
    teamName: "3조 김클라임",
    progress: 75,
  },
};
