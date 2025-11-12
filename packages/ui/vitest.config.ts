import { createVitestConfig } from "../config/vitest.base";

export default createVitestConfig({
  test: {
    include: [
      "packages/ui/**/*.{test,spec}.ts",
      "packages/ui/**/*.{test,spec}.tsx",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./.coverage",
      reporter: ["text", "html"],
      include: ["packages/ui/src/**/*.{ts,tsx}"],
    },
  },
});
