import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    placeholder: {
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "Sample text",
    placeholder: "Enter text...",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <label htmlFor="input-example" className="text-sm font-medium">
        Label
      </label>
      <Input id="input-example" placeholder="Enter text..." />
    </div>
  ),
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Text Input</label>
        <Input type="text" placeholder="Enter text..." />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Disabled Input</label>
        <Input placeholder="Disabled input" disabled />
      </div>
    </div>
  ),
};
