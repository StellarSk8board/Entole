/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Providers command implementation
 */

import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { providerRegistry } from '../providers/registry.js';
import { NormalizedError } from '../types.js';
import {
  getOutputFormat,
  outputContent,
  outputError,
  formatProviderList,
  formatProviderListJson,
  formatError,
  formatErrorJson,
} from '../output/index.js';

// Import providers to ensure they're registered
import '../providers/index.js';

export const providersCommand = new Command('providers').description(
  'Manage AI providers'
);

// List subcommand
providersCommand
  .command('list')
  .description('List available providers and their capabilities')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    const startTime = Date.now();
    let configLoadTime = 0;
    const outputFormat = getOutputFormat(options.json);

    try {
      // Load configuration to show current defaults
      const configStart = Date.now();
      const { config } = await loadConfig({
        cliFlags: {
          json: options.json,
        },
      });
      configLoadTime = Date.now() - configStart;

      // Get provider information
      const providers = providerRegistry.getProviderInfo();

      const timingsMs = {
        total: Date.now() - startTime,
        provider: 0,
        config: configLoadTime,
      };

      if (outputFormat === 'json') {
        const result = formatProviderListJson(providers, timingsMs);
        outputContent(result, outputFormat);
      } else {
        // Use the new human-friendly formatter
        const result = formatProviderList(providers);
        outputContent(result, outputFormat);

        // Add configuration summary
        if (
          config.providers?.default?.chat ||
          config.providers?.default?.embeddings
        ) {
          outputContent('\nCurrent Defaults:', outputFormat);
          if (config.providers.default.chat) {
            outputContent(
              `  Chat: ${config.providers.default.chat}`,
              outputFormat
            );
          }
          if (config.providers.default.embeddings) {
            outputContent(
              `  Embeddings: ${config.providers.default.embeddings}`,
              outputFormat
            );
          }
        } else {
          outputContent(
            '\nNo default providers configured. Will use first available provider for each capability.',
            outputFormat
          );
        }
      }
    } catch (error) {
      const totalTime = Date.now() - startTime;

      // Normalize error properly
      let normalizedError: NormalizedError;
      if (
        error &&
        typeof error === 'object' &&
        'provider' in error &&
        'type' in error
      ) {
        normalizedError = error as NormalizedError;
      } else {
        normalizedError = {
          provider: 'unknown',
          type: 'internal',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        };
      }

      const timingsMs = {
        total: totalTime,
        provider: 0,
        config: configLoadTime,
      };

      if (outputFormat === 'json') {
        const errorResult = formatErrorJson(
          'providers',
          normalizedError,
          normalizedError.provider,
          undefined,
          timingsMs
        );
        outputError(errorResult, outputFormat);
      } else {
        const errorResult = formatError(normalizedError);
        outputError(errorResult, outputFormat);
      }

      process.exit(1);
    }
  });
