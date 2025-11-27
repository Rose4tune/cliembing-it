import { createVitestConfig } from "./packages/config/vitest.base";

export default createVitestConfig({
  test: {
    include: [
      "packages/**/*.{test,spec}.ts",
      "packages/**/*.{test,spec}.tsx",
      "apps/**/*.{test,spec}.ts",
      "apps/**/*.{test,spec}.tsx",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./.coverage",
      reporter: ["text", "html"],
      include: [
        "packages/domain/src/**/*.ts",
        "packages/features/src/**/*.ts",
        "packages/shared/src/**/*.{ts,tsx}",
        "packages/ui/src/**/*.{ts,tsx}",
        "apps/web/**/*.{ts,tsx}",
      ],
    },
  },
});
