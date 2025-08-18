/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Chat command implementation
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { loadConfig } from '../config/loader.js';
import { providerRegistry } from '../providers/registry.js';
import { ChatParams, NormalizedError } from '../types.js';
import {
  getOutputFormat,
  outputContent,
  outputError,
  formatChatResponse,
  formatChatResponseJson,
  formatError,
  formatErrorJson,
  StreamingOutput,
  StreamingJsonOutput,
} from '../output/index.js';
import { initializeTimings, withTiming } from '../timings.js';

// Import providers to ensure they're registered
import '../providers/index.js';

export const chatCommand = new Command('chat')
  .description('Chat with an AI provider')
  .argument('[prompt]', 'The prompt to send to the AI (or use --file)')
  .option(
    '-p, --provider <provider>',
    'AI provider to use (openai, anthropic, ollama, openrouter)'
  )
  .option('-m, --model <model>', 'Model to use')
  .option(
    '-f, --file <file>',
    'Read prompt from file (use @filename in prompt for inline file reading)'
  )
  .option('-s, --stream', 'Stream the response', false)
  .option(
    '-t, --temperature <temp>',
    'Temperature for response generation',
    parseFloat
  )
  .option('--top-p <top_p>', 'Top-p for response generation', parseFloat)
  .option('--max-tokens <tokens>', 'Maximum tokens to generate', parseInt)
  .option('--json', 'Output in JSON format', false)
  .action(async (prompt, options) => {
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
          temperature: options.temperature,
          top_p: options.topP,
          max_tokens: options.maxTokens,
          json: options.json,
          stream: options.stream,
        },
      });
      configLoadTime = Date.now() - configStart;

      // Initialize timing collection based on configuration
      const timingsEnabled = config.observability?.timings ?? false;
      initializeTimings(timingsEnabled);

      // Determine the prompt text
      let promptText = prompt;

      // Handle file input
      if (options.file) {
        if (!existsSync(options.file)) {
          throw new Error(`File not found: ${options.file}`);
        }
        promptText = readFileSync(options.file, 'utf-8').trim();
      } else if (promptText && promptText.startsWith('@')) {
        // Handle @filename syntax
        const filename = promptText.slice(1);
        if (!existsSync(filename)) {
          throw new Error(`File not found: ${filename}`);
        }
        promptText = readFileSync(filename, 'utf-8').trim();
      }

      if (!promptText) {
        throw new Error(
          'No prompt provided. Use a prompt argument, --file option, or @filename syntax.'
        );
      }

      // Resolve provider
      const providerKey =
        options.provider || config.providers?.default?.chat || 'openai';
      const provider = providerRegistry.resolve(providerKey, 'chat');

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

      // Build chat parameters
      const chatParams: ChatParams = {
        model,
        messages: [{ role: 'user', content: promptText }],
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxTokens,
      };

      const providerStart = Date.now();
      const timingsMs = () => ({
        total: Date.now() - startTime,
        provider: providerTime,
        config: configLoadTime,
      });

      if (options.stream) {
        // Streaming response - timing is more complex for streaming
        if (outputFormat === 'json') {
          const streamingOutput = new StreamingJsonOutput(
            provider.key,
            model,
            timingsMs()
          );

          try {
            // Use withTiming for streaming operations
            await withTiming(
              async () => {
                for await (const chunk of provider.invokeChatStream(
                  chatParams
                )) {
                  streamingOutput.processChunk(chunk);
                }
                return { text: 'streaming_complete' }; // Placeholder for timing
              },
              {
                command: 'chat',
                provider: provider.key,
                model,
              }
            );
            providerTime = Date.now() - providerStart;

            const result = streamingOutput.finalize();
            outputContent(result, outputFormat);
          } catch (streamError) {
            const normalizedError = provider.normalizeError(streamError);
            const errorResult = streamingOutput.handleError(normalizedError);
            outputError(errorResult, outputFormat);
            process.exit(1);
          }
        } else {
          const streamingOutput = new StreamingOutput();

          try {
            // Use withTiming for streaming operations
            await withTiming(
              async () => {
                for await (const chunk of provider.invokeChatStream(
                  chatParams
                )) {
                  streamingOutput.processChunk(chunk);
                }
                return { text: 'streaming_complete' }; // Placeholder for timing
              },
              {
                command: 'chat',
                provider: provider.key,
                model,
              }
            );
            providerTime = Date.now() - providerStart;
          } catch (streamError) {
            const normalizedError = provider.normalizeError(streamError);
            streamingOutput.handleError(normalizedError);
            process.exit(1);
          }
        }
      } else {
        // Non-streaming response
        const response = await withTiming(
          () => provider.invokeChat(chatParams),
          {
            command: 'chat',
            provider: provider.key,
            model,
          }
        );
        providerTime = Date.now() - providerStart;

        if (outputFormat === 'json') {
          const result = formatChatResponseJson(
            response,
            provider.key,
            model,
            timingsMs()
          );
          outputContent(result, outputFormat);
        } else {
          const result = formatChatResponse(response, provider.key, model);
          outputContent(result, outputFormat);
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
        provider: providerTime,
        config: configLoadTime,
      };

      if (outputFormat === 'json') {
        const errorResult = formatErrorJson(
          'chat',
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
