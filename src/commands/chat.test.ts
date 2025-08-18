/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for the chat command functionality
 *
 * This test suite validates the chat command structure, options, arguments,
 * and basic functionality. It tests command metadata, CLI option parsing,
 * and ensures the command is properly configured for the Entole CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatCommand } from './chat.js';

// Mock dependencies to prevent actual execution during tests
vi.mock('../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../providers/registry.js', () => ({
  providerRegistry: {
    resolve: vi.fn(),
  },
  registerProvider: vi.fn(),
}));

vi.mock('../output/index.js', () => ({
  getOutputFormat: vi.fn(),
  outputContent: vi.fn(),
  outputError: vi.fn(),
  formatChatResponse: vi.fn(),
  formatChatResponseJson: vi.fn(),
  formatError: vi.fn(),
  formatErrorJson: vi.fn(),
  StreamingOutput: vi.fn(),
  StreamingJsonOutput: vi.fn(),
}));

vi.mock('../timings.js', () => ({
  initializeTimings: vi.fn(),
  withTiming: vi.fn(),
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock provider adapters
vi.mock('../providers/ollama.js', () => ({
  OllamaAdapter: vi.fn(),
}));

vi.mock('../providers/openai.js', () => ({
  OpenAIAdapter: vi.fn(),
}));

vi.mock('../providers/anthropic.js', () => ({
  AnthropicAdapter: vi.fn(),
}));

vi.mock('../providers/openrouter.js', () => ({
  OpenRouterAdapter: vi.fn(),
}));

vi.mock('../providers/mistral.js', () => ({
  MistralAdapter: vi.fn(),
}));

vi.mock('../providers/cohere.js', () => ({
  CohereAdapter: vi.fn(),
}));

describe('chat command', () => {
  const originalExit = process.exit;
  const originalConsoleLog = console.log;

  beforeEach(() => {
    // Mock process.exit to prevent actual exit during tests
    process.exit = vi.fn() as never;

    // Mock console.log to prevent output during tests
    console.log = vi.fn();

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original functions
    process.exit = originalExit;
    console.log = originalConsoleLog;
  });

  describe('command structure', () => {
    it('should have correct command metadata', () => {
      expect(chatCommand.name()).toBe('chat');
      expect(chatCommand.description()).toBe('Chat with an AI provider');
    });

    it('should have all expected options', () => {
      const options = chatCommand.options;
      const optionNames = options.map((opt) => opt.long);

      expect(optionNames).toContain('--provider');
      expect(optionNames).toContain('--model');
      expect(optionNames).toContain('--file');
      expect(optionNames).toContain('--stream');
      expect(optionNames).toContain('--json');
      expect(optionNames).toContain('--temperature');
      expect(optionNames).toContain('--top-p');
      expect(optionNames).toContain('--max-tokens');
    });

    it('should have correct option descriptions', () => {
      const options = chatCommand.options;

      const providerOption = options.find((opt) => opt.long === '--provider');
      expect(providerOption?.description).toBe(
        'AI provider to use (openai, anthropic, ollama, openrouter)'
      );

      const modelOption = options.find((opt) => opt.long === '--model');
      expect(modelOption?.description).toBe('Model to use');

      const fileOption = options.find((opt) => opt.long === '--file');
      expect(fileOption?.description).toBe(
        'Read prompt from file (use @filename in prompt for inline file reading)'
      );

      const streamOption = options.find((opt) => opt.long === '--stream');
      expect(streamOption?.description).toBe('Stream the response');

      const jsonOption = options.find((opt) => opt.long === '--json');
      expect(jsonOption?.description).toBe('Output in JSON format');
    });

    it('should have correct argument structure', () => {
      // Access the internal _args property safely
      const args = (chatCommand as unknown as { _args: unknown[] })._args;
      expect(args).toHaveLength(1);

      const promptArg = args[0] as {
        name(): string;
        description: string;
        required: boolean;
      };
      expect(promptArg.name()).toBe('prompt');
      expect(promptArg.description).toBe(
        'The prompt to send to the AI (or use --file)'
      );
      expect(promptArg.required).toBe(false); // Optional argument
    });

    it('should have an action handler configured', () => {
      // Check that the command has been configured with an action
      expect(chatCommand.action).toBeDefined();
    });
  });

  describe('option parsing', () => {
    it('should have temperature option with parser', () => {
      const temperatureOption = chatCommand.options.find(
        (opt) => opt.long === '--temperature'
      );
      expect(temperatureOption?.argParser).toBeDefined();
      expect(typeof temperatureOption?.argParser).toBe('function');
    });

    it('should have top-p option with parser', () => {
      const topPOption = chatCommand.options.find(
        (opt) => opt.long === '--top-p'
      );
      expect(topPOption?.argParser).toBeDefined();
      expect(typeof topPOption?.argParser).toBe('function');
    });

    it('should have max-tokens option with parser', () => {
      const maxTokensOption = chatCommand.options.find(
        (opt) => opt.long === '--max-tokens'
      );
      expect(maxTokensOption?.argParser).toBeDefined();
      expect(typeof maxTokensOption?.argParser).toBe('function');
    });

    it('should have stream option as boolean with default false', () => {
      const streamOption = chatCommand.options.find(
        (opt) => opt.long === '--stream'
      );
      expect(streamOption?.defaultValue).toBe(false);
    });

    it('should have json option as boolean with default false', () => {
      const jsonOption = chatCommand.options.find(
        (opt) => opt.long === '--json'
      );
      expect(jsonOption?.defaultValue).toBe(false);
    });
  });

  describe('command integration', () => {
    it('should be a valid Commander.js command', () => {
      expect(chatCommand.constructor.name).toBe('Command');
      expect(typeof chatCommand.parse).toBe('function');
      expect(typeof chatCommand.parseAsync).toBe('function');
    });

    it('should have proper option flags', () => {
      const options = chatCommand.options;

      // Check short flags
      const providerOption = options.find((opt) => opt.long === '--provider');
      expect(providerOption?.short).toBe('-p');

      const modelOption = options.find((opt) => opt.long === '--model');
      expect(modelOption?.short).toBe('-m');

      const fileOption = options.find((opt) => opt.long === '--file');
      expect(fileOption?.short).toBe('-f');

      const streamOption = options.find((opt) => opt.long === '--stream');
      expect(streamOption?.short).toBe('-s');

      const temperatureOption = options.find(
        (opt) => opt.long === '--temperature'
      );
      expect(temperatureOption?.short).toBe('-t');
    });
  });
});
