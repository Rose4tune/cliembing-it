import type { Meta, StoryObj } from "@storybook/react";
import { FooterNavigation } from "./FooterNavigation";
import { SessionProvider } from "next-auth/react";

const meta: Meta<typeof FooterNavigation> = {
  title: "Components/FooterNavigation",
  component: FooterNavigation,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SessionProvider>
        <Story />
      </SessionProvider>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof FooterNavigation>;

export const Default: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/",
      },
    },
  },
};

export const OnGamePage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/game",
      },
    },
  },
};

export const OnDashboardPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/rankboard",
      },
    },
  },
};

export const OnProfilePage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/profile",
      },
    },
  },
};
