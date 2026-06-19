import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Resource caps: locally limit to 2 workers so the suite can't saturate
    // CPU/RAM and freeze the dev machine. CI (few cores) uses 50%.
    maxWorkers: process.env.CI ? "50%" : 2,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
