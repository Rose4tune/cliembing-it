import type { Meta, StoryObj } from "@storybook/react";
import { CreatePartyCard } from "./CreatePartyCard";
import { SessionProvider } from "next-auth/react";

const meta: Meta<typeof CreatePartyCard> = {
  title: "Components/PartyCards/CreatePartyCard",
  component: CreatePartyCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SessionProvider
        session={{
          user: { name: "김클라임", email: "test@example.com" },
          expires: "2024-12-31",
        }}
      >
        <Story />
      </SessionProvider>
    ),
  ],
  argTypes: {
    onCreate: { action: "party created" },
  },
};

export default meta;
type Story = StoryObj<typeof CreatePartyCard>;

export const Default: Story = {
  args: {},
};

export const WithCallback: Story = {
  args: {
    onCreate: (title: string) => {
      console.log("Creating party with title:", title);
    },
  },
};
