import { createVitestConfig } from "../config/vitest.base";

export default createVitestConfig({
  test: {
    include: [
      "packages/ui-web/**/*.{test,spec}.ts",
      "packages/ui-web/**/*.{test,spec}.tsx",
    ],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./.coverage",
      reporter: ["text", "html"],
      include: ["packages/ui-web/src/**/*.{ts,tsx}"],
    },
  },
});
