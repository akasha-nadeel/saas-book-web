import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the "@/..." alias from tsconfig.json. Native since Vite 7 —
    // the vite-tsconfig-paths plugin is no longer needed for this.
    tsconfigPaths: true,
  },
  test: {
    // jsdom for localStorage, not for a DOM — these are unit tests.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
