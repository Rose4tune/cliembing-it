import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import type { UserConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const baseConfig = defineConfig({
  root: repoRoot,
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@pkg/ui-web": join(repoRoot, "packages/ui-web/src/index.ts"),
      "@pkg/ui-web/*": join(repoRoot, "packages/ui-web/src/*"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    reporters: ["default"],
    passWithNoTests: false,
  },
});

export const createVitestConfig = (config: UserConfig = {}) => mergeConfig(baseConfig, config);
