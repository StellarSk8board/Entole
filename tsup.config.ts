/**
 * Copyright 2024 Metisse
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: ['better-sqlite3'], // Optional dependency
  target: 'node18',
  splitting: false,
  minify: false,
  dts: false, // We don't need declaration files for CLI
});