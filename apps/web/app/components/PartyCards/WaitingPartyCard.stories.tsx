import type { Meta, StoryObj } from "@storybook/react";
import { WaitingPartyCard } from "./WaitingPartyCard";

const meta: Meta<typeof WaitingPartyCard> = {
  title: "Components/PartyCards/WaitingPartyCard",
  component: WaitingPartyCard,
  tags: ["autodocs"],
  argTypes: {
    partyName: { control: "text" },
    teamName: { control: "text" },
    date: { control: "text" },
    startTime: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof WaitingPartyCard>;

export const Default: Story = {
  args: {
    partyName: "vol.4 테트리스",
    teamName: "3조 김클라임",
    date: "2025.11.26",
    startTime: "19:00",
  },
};

export const Custom: Story = {
  args: {
    partyName: "vol.5 볼더링",
    teamName: "5조 파티게임",
    date: "2025.12.01",
    startTime: "14:00",
  },
};
