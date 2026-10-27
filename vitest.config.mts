import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const alias = { "@": path.resolve(root, "src"), "server-only": path.resolve(root, "tests/stubs/server-only.ts") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          // One shared PGlite database: run files one after another.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
