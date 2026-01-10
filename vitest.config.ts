import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Point Vitest at a dedicated, workspace-controlled env directory to avoid
  // permission issues reading a protected root .env file during tests.
  envDir: path.resolve(__dirname, "tests/env"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"]
    }
  }
});
