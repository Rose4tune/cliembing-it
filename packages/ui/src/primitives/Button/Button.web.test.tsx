import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { Button } from "./Button.web";

describe("Button.web", () => {
  it("renders provided children", () => {
    render(<Button>Click me</Button>);

    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });
});
