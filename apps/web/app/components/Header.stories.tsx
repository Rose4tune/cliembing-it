import type { Meta, StoryObj } from "@storybook/react";
import { Header } from "./Header";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

const meta: Meta<typeof Header> = {
  title: "Components/Header",
  component: Header,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Story />
        </ThemeProvider>
      </SessionProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

export const LoggedOut: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export const LoggedIn: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <SessionProvider
        session={{
          user: {
            name: "테스트 사용자",
            email: "test@example.com",
          },
          expires: "2024-12-31",
        }}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Story />
        </ThemeProvider>
      </SessionProvider>
    ),
  ],
};
