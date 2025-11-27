import { createVitestConfig } from "../../packages/config/vitest.base";

export default createVitestConfig({
  test: {
    include: ["apps/web/**/*.{test,spec}.ts", "apps/web/**/*.{test,spec}.tsx"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./.coverage",
      reporter: ["text", "html"],
      include: ["apps/web/**/*.{ts,tsx}"],
    },
  },
});
