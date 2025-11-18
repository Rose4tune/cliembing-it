import type { Meta, StoryObj } from "@storybook/react";
import { FeatureCards } from "./FeatureCards";

const meta: Meta<typeof FeatureCards> = {
  title: "Components/PartyCards/FeatureCards",
  component: FeatureCards,
  tags: ["autodocs"],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof FeatureCards>;

export const Default: Story = {};
