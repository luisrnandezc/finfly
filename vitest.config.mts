process.env.CDS_TYPESCRIPT = 'true';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    // CAP starts both services and UI5 applications for each integration suite.
    // Allow enough time for that setup on slower local and CI machines.
    hookTimeout: 30_000,
  },
});
