import type { StorybookConfig } from "@storybook/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAbsolutePath = (pkg: string) =>
  path.dirname(require.resolve(path.join(pkg, "package.json")));

const config: StorybookConfig = {
  framework: {
    name: "@storybook/nextjs",
    options: {
      nextConfigPath: path.resolve(__dirname, "../../web/next.config.ts"),
    },
  },
  stories: [
    "../../web/app/**/*.stories.@(ts|tsx|mdx)",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx|mdx)",
    "../../../packages/ui-web/src/**/*.stories.@(ts|tsx|mdx)",
  ],
  addons: [getAbsolutePath("@storybook/addon-links")],
  staticDirs: [{ from: "../../web/public", to: "/public" }],
  webpackFinal: async (cfg) => {
    //   const { createRequire } = await import("node:module");
    //   const path = (await import("node:path")).default;
    //   const require = createRequire(import.meta.url);

    //   const reactPath = path.dirname(require.resolve("react/package.json"));
    //   const reactDomPath = path.dirname(
    //     require.resolve("react-dom/package.json")
    //   );

    //   cfg.resolve ??= {};
    //   cfg.resolve.alias = {
    //     ...(cfg.resolve.alias || {}),
    //     react: reactPath,
    //     "react-dom": reactDomPath,
    //   };

    // 타입 경고 회피 + 안전가드
    cfg.resolve ??= { extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx"] };

    // tsconfig-paths 연동(선택)
    const { default: TsconfigPathsPlugin } = await import(
      "tsconfig-paths-webpack-plugin"
    );
    (cfg.resolve.plugins ??= []).push(new TsconfigPathsPlugin());

    return cfg;
  },
};

export default config;
