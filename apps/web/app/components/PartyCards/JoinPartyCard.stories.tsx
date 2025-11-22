import type { Meta, StoryObj } from "@storybook/react";
import { JoinPartyCard } from "./JoinPartyCard";

const meta: Meta<typeof JoinPartyCard> = {
  title: "Components/PartyCards/JoinPartyCard",
  component: JoinPartyCard,
  tags: ["autodocs"],
  argTypes: {
    onJoin: { action: "joined" },
    defaultName: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof JoinPartyCard>;

export const Empty: Story = {
  args: {
    defaultName: "",
  },
};

export const WithName: Story = {
  args: {
    defaultName: "김클라임",
  },
};

export const WithCallback: Story = {
  args: {
    defaultName: "김클라임",
    onJoin: (name) => {
      console.log("Joined with name:", name);
    },
  },
};
