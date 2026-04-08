import { defineConfig, devices } from "@playwright/test";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";

export default defineConfig({
  testDir: "./e2e/performance",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  workers: 1,
  retries: 0,
  reporter: [
    ["html", { open: "never", outputFolder: "performance-report" }],
    ["list"],
    ["json", { outputFile: "performance-report/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node -e \"require('fs').rmSync('.next',{recursive:true,force:true})\" && npm run dev:test",
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
      NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-proops-test.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-proops-test",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-proops-test.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:demo",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION: "true",
      FUNCTIONS_LOCAL_API_URL: "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api",
    },
  },
});
