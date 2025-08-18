/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Embed command implementation
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { loadConfig } from '../config/loader.js';
import { providerRegistry } from '../providers/registry.js';
import { EmbeddingParams, NormalizedError } from '../types.js';
import {
  getOutputFormat,
  outputContent,
  outputError,
  formatEmbeddingResponse,
  formatEmbeddingResponseJson,
  formatError,
  formatErrorJson,
} from '../output/index.js';
import { initializeTimings, withTiming } from '../timings.js';

// Import providers to ensure they're registered
import '../providers/index.js';

export const embedCommand = new Command('embed')
  .description('Generate embeddings for text')
  .argument('<input>', 'Text to embed (or @filename to read from file)')
  .option(
    '-p, --provider <provider>',
    'AI provider to use (openai, ollama, openrouter)'
  )
  .option('-m, --model <model>', 'Model to use for embeddings')
  .option('--json', 'Output in JSON format', false)
  .action(async (input, options) => {
    const startTime = Date.now();
    let configLoadTime = 0;
    let providerTime = 0;
    const outputFormat = getOutputFormat(options.json);

    try {
      // Load configuration
      const configStart = Date.now();
      const { config } = await loadConfig({
        cliFlags: {
          provider: options.provider,
          model: options.model,
          json: options.json,
        },
      });
      configLoadTime = Date.now() - configStart;

      // Initialize timing collection based on configuration
      const timingsEnabled = config.observability?.timings ?? false;
      initializeTimings(timingsEnabled);

      // Determine the input text
      let inputText = input;

      // Handle file input with @filename syntax
      if (input.startsWith('@')) {
        const filename = input.slice(1);
        if (!existsSync(filename)) {
          throw new Error(`File not found: ${filename}`);
        }
        inputText = readFileSync(filename, 'utf-8').trim();
      }

      if (!inputText) {
        throw new Error('No input text provided.');
      }

      // Resolve provider
      const providerKey =
        options.provider || config.providers?.default?.embeddings || 'openai';
      const provider = providerRegistry.resolve(providerKey, 'embeddings');

      // Determine model - fix the type issue by being more specific
      let model = options.model;
      if (!model && config.providers) {
        const providerConfig =
          config.providers[providerKey as keyof typeof config.providers];
        if (
          providerConfig &&
          typeof providerConfig === 'object' &&
          'defaultModel' in providerConfig
        ) {
          model = providerConfig.defaultModel;
        }
      }

      // Build embedding parameters
      const embeddingParams: EmbeddingParams = {
        model,
        input: inputText,
      };

      const providerStart = Date.now();
      const response = await withTiming(
        () => provider.invokeEmbeddings(embeddingParams),
        {
          command: 'embed',
          provider: provider.key,
          model,
        }
      );
      providerTime = Date.now() - providerStart;

      const timingsMs = {
        total: Date.now() - startTime,
        provider: providerTime,
        config: configLoadTime,
      };

      if (outputFormat === 'json') {
        const result = formatEmbeddingResponseJson(
          response,
          provider.key,
          model,
          timingsMs
        );
        outputContent(result, outputFormat);
      } else {
        const result = formatEmbeddingResponse(response, provider.key, model);
        outputContent(result, outputFormat);
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
        provider: providerTime,
        config: configLoadTime,
      };

      if (outputFormat === 'json') {
        const errorResult = formatErrorJson(
          'embed',
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
