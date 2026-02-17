import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./src/test-utils/setup.ts"],
    exclude: ["dist/**", "node_modules/**"],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: "postgresql://cove:cove@localhost:5433/cove_test",
      JWT_SECRET: "test-secret-key-for-vitest",
      RESEND_API_KEY: "re_test_fake_key_for_vitest",
    },
  },
});
