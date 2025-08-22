/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Entole CLI - Multi-provider AI CLI for chat and embeddings
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { closeTimings } from './timings.js';

// Import commands
import { chatCommand } from './commands/chat.js';
import { embedCommand } from './commands/embed.js';
import { providersCommand } from './commands/providers.js';
import { doctorCommand } from './commands/doctor.js';

// Re-export loadConfig for external use
export { loadConfig } from './config/loader.js';

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('entole')
  .description('Multi-provider AI CLI for chat and embeddings by Metisse')
  .version(packageJson.version);

// Add commands
program.addCommand(chatCommand);
program.addCommand(embedCommand);
program.addCommand(providersCommand);
program.addCommand(doctorCommand);

// Handle cleanup on exit
process.on('exit', () => {
  closeTimings().catch(() => {
    // Ignore cleanup errors on exit
  });
});

process.on('SIGINT', async () => {
  await closeTimings();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeTimings();
  process.exit(0);
});

// Parse command line arguments
program.parse();

// Export types for library usage
export * from './types.js';
export * from './providers/index.js';
export * from './timings.js';
