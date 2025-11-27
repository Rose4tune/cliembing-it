import type { Meta, StoryObj } from "@storybook/react";
import { LevelScoreCounter } from "./LevelScoreCounter";

const meta: Meta<typeof LevelScoreCounter> = {
  title: "Components/ScoreCounter/LevelScoreCounter",
  component: LevelScoreCounter,
  tags: ["autodocs"],
  argTypes: {
    level: {
      control: "select",
      options: [
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "navy",
        "purple",
        "hite",
        "white",
        "black",
      ],
    },
    levelLabel: { control: "text" },
    score: { control: "number" },
    isMine: { control: "boolean" },
    disabled: { control: "boolean" },
    pointsPerProblem: { control: "number" },
    onChange: { action: "score-changed" },
  },
};

export default meta;
type Story = StoryObj<typeof LevelScoreCounter>;

export const Red: Story = {
  args: {
    level: "red",
    levelLabel: "Red",
    score: 0,
    isMine: true,
    disabled: false,
    pointsPerProblem: 1,
  },
};

export const Orange: Story = {
  args: {
    level: "orange",
    levelLabel: "Orange",
    score: 2,
    isMine: true,
    disabled: false,
  },
};

export const Yellow: Story = {
  args: {
    level: "yellow",
    levelLabel: "Yellow",
    score: 0,
    isMine: true,
    disabled: false,
  },
};

export const Green: Story = {
  args: {
    level: "green",
    levelLabel: "Green",
    score: 5,
    isMine: true,
    disabled: false,
  },
};

export const Blue: Story = {
  args: {
    level: "blue",
    levelLabel: "Blue",
    score: 3,
    isMine: true,
    disabled: false,
  },
};

export const Navy: Story = {
  args: {
    level: "navy",
    levelLabel: "Navy",
    score: 0,
    isMine: true,
    disabled: false,
  },
};

export const Purple: Story = {
  args: {
    level: "purple",
    levelLabel: "Purple",
    score: 7,
    isMine: true,
    disabled: false,
  },
};

export const Hite: Story = {
  args: {
    level: "hite",
    levelLabel: "Hite",
    score: 0,
    isMine: true,
    disabled: false,
  },
};

export const White: Story = {
  args: {
    level: "white",
    levelLabel: "White",
    score: 2,
    isMine: true,
    disabled: false,
  },
};

export const Black: Story = {
  args: {
    level: "black",
    levelLabel: "Black",
    score: 1,
    isMine: true,
    disabled: false,
  },
};

export const IsMineFalse: Story = {
  args: {
    level: "blue",
    levelLabel: "Blue",
    score: 3,
    isMine: false,
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    level: "purple",
    levelLabel: "Purple",
    score: 5,
    isMine: true,
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4 p-4">
      <LevelScoreCounter level="red" levelLabel="Red" score={0} isMine={true} />
      <LevelScoreCounter level="orange" levelLabel="Orange" score={2} isMine={true} />
      <LevelScoreCounter level="yellow" levelLabel="Yellow" score={0} isMine={true} />
      <LevelScoreCounter level="green" levelLabel="Green" score={5} isMine={true} />
      <LevelScoreCounter level="blue" levelLabel="Blue" score={3} isMine={true} />
      <LevelScoreCounter level="navy" levelLabel="Navy" score={0} isMine={true} />
      <LevelScoreCounter level="purple" levelLabel="Purple" score={7} isMine={true} />
      <LevelScoreCounter level="hite" levelLabel="Hite" score={0} isMine={true} />
      <LevelScoreCounter level="white" levelLabel="White" score={2} isMine={true} />
      <LevelScoreCounter level="black" levelLabel="Black" score={1} isMine={true} />
      <LevelScoreCounter level="blue" levelLabel="Blue" score={3} isMine={false} />
      <LevelScoreCounter
        level="purple"
        levelLabel="Purple"
        score={5}
        isMine={true}
        disabled={true}
      />
    </div>
  ),
};
