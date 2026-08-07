import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Unit tests only. E2E lives in ./e2e and belongs to Playwright — keeping the
// include scoped stops Vitest collecting *.spec.ts files it cannot run.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
