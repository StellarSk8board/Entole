/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for human-friendly output formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatChatResponse,
  formatEmbeddingResponse,
  formatProviderList,
  formatModelList,
  formatError,
  formatTimings,
  formatSuccess,
  StreamingOutput,
} from './human.js';
import type {
  ChatResponse,
  EmbeddingResponse,
  ModelInfo,
  NormalizedError,
  ChatStreamChunk,
} from '../types.js';

describe('formatChatResponse', () => {
  it('should format basic chat response', () => {
    const response: ChatResponse = {
      text: 'Hello, world!',
    };

    const result = formatChatResponse(response);
    expect(result).toBe('Hello, world!');
  });

  it('should format chat response with metadata', () => {
    const response: ChatResponse = {
      text: 'Hello, world!',
      meta: {
        model: 'gpt-4',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        finish_reason: 'stop',
      },
    };

    const result = formatChatResponse(response, 'openai', 'gpt-4');
    expect(result).toContain('Hello, world!');
    expect(result).toContain('Provider: openai');
    expect(result).toContain('Model: gpt-4');
    expect(result).toContain('Usage: 10 prompt, 5 completion, 15 total tokens');
    expect(result).toContain('Finish reason: stop');
  });

  it('should handle partial metadata', () => {
    const response: ChatResponse = {
      text: 'Hello!',
      meta: {
        usage: {
          total_tokens: 20,
        },
      },
    };

    const result = formatChatResponse(response, 'anthropic');
    expect(result).toContain('Provider: anthropic');
    expect(result).toContain('Usage: 20 total tokens');
  });
});

describe('formatEmbeddingResponse', () => {
  it('should format basic embedding response', () => {
    const response: EmbeddingResponse = {
      vectors: [[0.1, 0.2, 0.3, 0.4, 0.5]],
    };

    const result = formatEmbeddingResponse(response);
    expect(result).toContain('Generated 1 embedding with 5 dimensions');
    expect(result).toContain(
      'Preview: [0.1000, 0.2000, 0.3000, 0.4000, 0.5000]'
    );
  });

  it('should format multiple embeddings', () => {
    const response: EmbeddingResponse = {
      vectors: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ],
    };

    const result = formatEmbeddingResponse(response);
    expect(result).toContain('Generated 2 embeddings with 3 dimensions');
  });

  it('should truncate long vectors in preview', () => {
    const response: EmbeddingResponse = {
      vectors: [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]],
    };

    const result = formatEmbeddingResponse(response);
    expect(result).toContain(
      'Preview: [0.1000, 0.2000, 0.3000, 0.4000, 0.5000, ...]'
    );
  });

  it('should include metadata', () => {
    const response: EmbeddingResponse = {
      vectors: [[0.1, 0.2]],
      meta: {
        model: 'text-embedding-ada-002',
        usage: {
          prompt_tokens: 5,
          total_tokens: 5,
        },
      },
    };

    const result = formatEmbeddingResponse(response, 'openai');
    expect(result).toContain('Provider: openai');
    expect(result).toContain('Model: text-embedding-ada-002');
    expect(result).toContain('Usage: 5 prompt, 5 total tokens');
  });
});

describe('formatProviderList', () => {
  it('should format empty provider list', () => {
    const result = formatProviderList([]);
    expect(result).toBe('No providers available');
  });

  it('should format provider list with capabilities', () => {
    const providers = [
      {
        key: 'openai',
        label: 'OpenAI',
        capabilities: {
          chat: true,
          embeddings: true,
          image: false,
          tools: false,
        },
      },
      {
        key: 'anthropic',
        label: 'Anthropic',
        capabilities: {
          chat: true,
          embeddings: false,
          image: false,
          tools: false,
        },
      },
    ];

    const result = formatProviderList(providers);
    expect(result).toContain('Available providers:');
    expect(result).toContain('openai       OpenAI (chat, embeddings)');
    expect(result).toContain('anthropic    Anthropic (chat)');
  });

  it('should handle providers with no capabilities', () => {
    const providers = [
      {
        key: 'stub',
        label: 'Stub Provider',
        capabilities: {
          chat: false,
          embeddings: false,
          image: false,
          tools: false,
        },
      },
    ];

    const result = formatProviderList(providers);
    expect(result).toContain('stub         Stub Provider (no capabilities)');
  });
});

describe('formatModelList', () => {
  it('should format empty model list', () => {
    const result = formatModelList([]);
    expect(result).toBe('No models available');
  });

  it('should format model list with provider', () => {
    const models: ModelInfo[] = [
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' },
      { id: 'gpt-3.5-turbo' },
    ];

    const result = formatModelList(models, 'openai');
    expect(result).toContain('Available models for openai:');
    expect(result).toContain('gpt-4 (GPT-4) - Most capable model');
    expect(result).toContain('gpt-3.5-turbo');
  });
});

describe('formatError', () => {
  it('should format basic error', () => {
    const error: NormalizedError = {
      provider: 'openai',
      type: 'auth',
      message: 'Invalid API key',
      retryable: false,
    };

    const result = formatError(error);
    expect(result).toContain('❌ Error from openai:');
    expect(result).toContain('Invalid API key');
  });

  it('should include hint and retry information', () => {
    const error: NormalizedError = {
      provider: 'anthropic',
      type: 'rate_limit',
      message: 'Rate limit exceeded',
      hint: 'Wait before retrying',
      retryable: true,
    };

    const result = formatError(error);
    expect(result).toContain('💡 Wait before retrying');
    expect(result).toContain('🔄 This error is retryable');
  });
});

describe('formatTimings', () => {
  it('should format timing information', () => {
    const timings = { total: 1500, provider: 1200, config: 300 };
    const result = formatTimings(timings);
    expect(result).toBe('⏱️  1500ms total, 1200ms provider, 300ms config');
  });

  it('should handle missing timings', () => {
    const result = formatTimings();
    expect(result).toBe('');
  });

  it('should handle partial timings', () => {
    const timings = { total: 1000, provider: 800, config: 0 };
    const result = formatTimings(timings);
    expect(result).toBe('⏱️  1000ms total, 800ms provider');
  });
});

describe('formatSuccess', () => {
  it('should format basic success message', () => {
    const result = formatSuccess('Operation completed');
    expect(result).toBe('✅ Operation completed');
  });

  it('should include metadata', () => {
    const metadata = { provider: 'openai', model: 'gpt-4', tokens: 150 };
    const result = formatSuccess('Chat completed', metadata);
    expect(result).toContain('✅ Chat completed');
    expect(result).toContain('provider: openai • model: gpt-4 • tokens: 150');
  });

  it('should filter out undefined metadata', () => {
    const metadata = { provider: 'openai', model: undefined, tokens: null };
    const result = formatSuccess('Done', metadata);
    expect(result).toContain('provider: openai');
    expect(result).not.toContain('model:');
    expect(result).not.toContain('tokens:');
  });
});

describe('StreamingOutput', () => {
  let mockStdout: { write: ReturnType<typeof vi.fn> };
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    mockStdout = { write: vi.fn() };
    originalWrite = process.stdout.write;
    process.stdout.write = mockStdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it('should handle streaming chunks', () => {
    const streaming = new StreamingOutput();

    const chunk1: ChatStreamChunk = { delta: 'Hello', done: false };
    const chunk2: ChatStreamChunk = { delta: ' world', done: false };
    const finalChunk: ChatStreamChunk = { delta: '!', done: true };

    streaming.processChunk(chunk1);
    streaming.processChunk(chunk2);
    streaming.processChunk(finalChunk);

    expect(mockStdout.write).toHaveBeenCalledWith('Hello');
    expect(mockStdout.write).toHaveBeenCalledWith(' world');
    expect(mockStdout.write).toHaveBeenCalledWith('!');
    expect(mockStdout.write).toHaveBeenCalledWith('\n');

    expect(streaming.getContent()).toBe('Hello world!');
  });

  it('should show metadata on completion', () => {
    const streaming = new StreamingOutput();

    const finalChunk: ChatStreamChunk = {
      delta: 'Done',
      done: true,
      meta: {
        model: 'gpt-4',
        usage: { total_tokens: 10 },
      },
    };

    streaming.processChunk(finalChunk);

    expect(mockStdout.write).toHaveBeenCalledWith('Done');
    expect(mockStdout.write).toHaveBeenCalledWith('\n');
    expect(mockStdout.write).toHaveBeenCalledWith(
      '\n─── Model: gpt-4 • Usage: 10 total tokens ───\n'
    );
  });

  it('should handle streaming errors', () => {
    const streaming = new StreamingOutput();
    const mockConsoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Start streaming
    streaming.processChunk({ delta: 'Hello', done: false });

    const error: NormalizedError = {
      provider: 'openai',
      type: 'network',
      message: 'Connection failed',
      retryable: true,
    };

    streaming.handleError(error);

    expect(mockStdout.write).toHaveBeenCalledWith('\n'); // Newline after partial content
    expect(mockConsoleError).toHaveBeenCalled();

    mockConsoleError.mockRestore();
  });
});
