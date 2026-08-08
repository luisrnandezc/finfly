process.env.CDS_TYPESCRIPT = 'true';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
  },
});
