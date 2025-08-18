/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for OpenRouter provider adapter
 *
 * This test suite validates the OpenRouter provider adapter functionality including:
 * - Chat completions with proper OpenRouter headers
 * - Streaming chat completions
 * - Embeddings through OpenRouter proxy
 * - Model listing from OpenRouter API
 * - Error normalization with OpenRouter-specific hints
 * - Configuration validation and environment variable handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterAdapter } from './openrouter.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenRouterAdapter', () => {
  let adapter: OpenRouterAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up adapter with test API key
    adapter = new OpenRouterAdapter({
      apiKey: 'sk-or-test-key-12345678901234567890123456789012',
      defaultModel: 'openai/gpt-4o-mini',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config = {
        apiKey: 'test-key',
        defaultModel: 'anthropic/claude-3-sonnet',
      };

      const customAdapter = new OpenRouterAdapter(config);

      expect(customAdapter.key).toBe('openrouter');
      expect(customAdapter.label).toBe('OpenRouter');
      expect(customAdapter.capabilities).toEqual({
        chat: true,
        embeddings: true,
        image: false,
        tools: false,
      });
    });

    it('should use environment variables as fallback', () => {
      const originalEnv = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'env-test-key';

      const envAdapter = new OpenRouterAdapter();

      expect(envAdapter.key).toBe('openrouter');

      process.env.OPENROUTER_API_KEY = originalEnv;
    });

    it('should not throw error during construction when no API key is provided', () => {
      const originalEnv = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      expect(() => new OpenRouterAdapter()).not.toThrow();

      process.env.OPENROUTER_API_KEY = originalEnv;
    });

    it('should use default model when not specified', () => {
      const defaultAdapter = new OpenRouterAdapter({
        apiKey: 'test-key',
      });

      expect(defaultAdapter.key).toBe('openrouter');
    });
  });

  describe('invokeChat', () => {
    const mockChatParams: ChatParams = {
      messages: [{ role: 'user', content: 'Hello, world!' }],
      temperature: 0.7,
      max_tokens: 100,
    };

    it('should successfully invoke chat completion with OpenRouter headers', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 9,
          total_tokens: 19,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.invokeChat(mockChatParams);

      expect(result).toEqual({
        text: 'Hello! How can I help you today?',
        meta: {
          model: 'openai/gpt-4o-mini',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 9,
            total_tokens: 19,
          },
          finish_reason: 'stop',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization:
              'Bearer sk-or-test-key-12345678901234567890123456789012',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/metisse-ai/entole',
            'X-Title': 'Entole CLI',
          }),
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: mockChatParams.messages,
            temperature: 0.7,
            max_tokens: 100,
            stream: false,
          }),
        })
      );
    });

    it('should use custom model when provided', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'anthropic/claude-3-opus',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response from Claude Opus',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        ...mockChatParams,
        model: 'anthropic/claude-3-opus',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"model":"anthropic/claude-3-opus"'),
        })
      );
    });

    it('should handle API errors with OpenRouter-specific hints', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => errorResponse,
        text: async () => JSON.stringify(errorResponse),
      });

      await expect(adapter.invokeChat(mockChatParams)).rejects.toMatchObject({
        provider: 'openrouter',
        type: 'auth',
        httpStatus: 401,
        hint: expect.stringContaining('OPENROUTER_API_KEY'),
      });
    });

    it('should handle empty choices', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'openai/gpt-4o-mini',
        choices: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(adapter.invokeChat(mockChatParams)).rejects.toThrow(
        'No choices returned from OpenRouter API'
      );
    });

    it('should validate required parameters', async () => {
      await expect(adapter.invokeChat({} as ChatParams)).rejects.toThrow(
        'Missing required parameters: messages'
      );
    });
  });

  describe('invokeChatStream', () => {
    const mockChatParams: ChatParams = {
      messages: [{ role: 'user', content: 'Tell me a story' }],
    };

    it('should successfully stream chat completion', async () => {
      const mockChunks = [
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"openai/gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Once"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"openai/gpt-4o-mini","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"openai/gpt-4o-mini","choices":[{"index":0,"delta":{"content":" a"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"openai/gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const chunks = [];
      for await (const chunk of adapter.invokeChatStream(mockChatParams)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        {
          delta: 'Once',
          done: false,
          meta: {
            model: 'openai/gpt-4o-mini',
            finish_reason: undefined,
          },
        },
        {
          delta: ' upon',
          done: false,
          meta: {
            model: 'openai/gpt-4o-mini',
            finish_reason: undefined,
          },
        },
        {
          delta: ' a',
          done: false,
          meta: {
            model: 'openai/gpt-4o-mini',
            finish_reason: undefined,
          },
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":true'),
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://github.com/metisse-ai/entole',
            'X-Title': 'Entole CLI',
          }),
        })
      );
    });

    it('should handle streaming errors', async () => {
      const errorResponse = {
        error: {
          message: 'Model not found',
          type: 'invalid_request_error',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => errorResponse,
        text: async () => JSON.stringify(errorResponse),
      });

      const generator = adapter.invokeChatStream(mockChatParams);

      await expect(generator.next()).rejects.toMatchObject({
        provider: 'openrouter',
        type: 'bad_request',
        httpStatus: 404,
      });
    });

    it('should handle malformed JSON in stream', async () => {
      const mockChunks = [
        'data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: invalid-json\n\n',
        'data: {"id":"chatcmpl-123","choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

      const chunks = [];
      for await (const chunk of adapter.invokeChatStream(mockChatParams)) {
        chunks.push(chunk);
      }

      // Should skip malformed JSON and continue
      expect(chunks).toHaveLength(1);
      expect(chunks[0].delta).toBe('Hello');
    });
  });

  describe('invokeEmbeddings', () => {
    const mockEmbeddingParams: EmbeddingParams = {
      input: 'Hello, world!',
    };

    it('should successfully invoke embeddings through OpenRouter', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: 'text-embedding-ada-002',
        usage: {
          prompt_tokens: 3,
          total_tokens: 3,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.invokeEmbeddings(mockEmbeddingParams);

      expect(result).toEqual({
        vectors: [[0.1, 0.2, 0.3]],
        meta: {
          model: 'text-embedding-ada-002',
          usage: {
            prompt_tokens: 3,
            total_tokens: 3,
          },
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://github.com/metisse-ai/entole',
            'X-Title': 'Entole CLI',
          }),
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: 'Hello, world!',
            encoding_format: 'float',
          }),
        })
      );
    });

    it('should handle multiple inputs', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
          {
            object: 'embedding',
            embedding: [0.4, 0.5, 0.6],
            index: 1,
          },
        ],
        model: 'text-embedding-ada-002',
        usage: {
          prompt_tokens: 6,
          total_tokens: 6,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.invokeEmbeddings({
        input: ['Hello', 'World'],
      });

      expect(result.vectors).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
    });

    it('should use custom model when provided', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: 'text-embedding-3-large',
        usage: {
          prompt_tokens: 3,
          total_tokens: 3,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeEmbeddings({
        ...mockEmbeddingParams,
        model: 'text-embedding-3-large',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/embeddings',
        expect.objectContaining({
          body: expect.stringContaining('"model":"text-embedding-3-large"'),
        })
      );
    });

    it('should handle empty embeddings response', async () => {
      const mockResponse = {
        object: 'list',
        data: [],
        model: 'text-embedding-ada-002',
        usage: {
          prompt_tokens: 0,
          total_tokens: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(
        adapter.invokeEmbeddings(mockEmbeddingParams)
      ).rejects.toThrow('No embeddings returned from OpenRouter API');
    });

    it('should validate required parameters', async () => {
      await expect(
        adapter.invokeEmbeddings({} as EmbeddingParams)
      ).rejects.toThrow('Missing required parameters: input');
    });
  });

  describe('getModels', () => {
    it('should successfully fetch models from OpenRouter API', async () => {
      const mockResponse = {
        data: [
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            description: 'OpenAI GPT-4o model',
            context_length: 128000,
            pricing: {
              prompt: '0.000005',
              completion: '0.000015',
            },
          },
          {
            id: 'text-embedding-ada-002',
            name: 'Text Embedding Ada 002',
            description: 'OpenAI embedding model',
            context_length: 8191,
          },
          {
            id: 'anthropic/claude-3-sonnet',
            name: 'Claude 3 Sonnet',
            description: 'Anthropic Claude 3 Sonnet',
            context_length: 200000,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const models = await adapter.getModels();

      expect(models).toEqual([
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          description: 'OpenAI GPT-4o model',
          capabilities: {
            chat: true,
            embeddings: false,
            image: true,
            tools: true,
          },
        },
        {
          id: 'text-embedding-ada-002',
          name: 'Text Embedding Ada 002',
          description: 'OpenAI embedding model',
          capabilities: {
            chat: false,
            embeddings: true,
            image: false,
            tools: false,
          },
        },
        {
          id: 'anthropic/claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          description: 'Anthropic Claude 3 Sonnet',
          capabilities: {
            chat: true,
            embeddings: false,
            image: true,
            tools: true,
          },
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization:
              'Bearer sk-or-test-key-12345678901234567890123456789012',
            'HTTP-Referer': 'https://github.com/metisse-ai/entole',
            'X-Title': 'Entole CLI',
          }),
        })
      );
    });

    it('should handle API errors when fetching models', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.getModels()).rejects.toThrow();
    });

    it('should return empty array when no models data', async () => {
      const mockResponse = {};

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const models = await adapter.getModels();
      expect(models).toEqual([]);
    });
  });

  describe('normalizeError', () => {
    it('should normalize 401 authentication errors with OpenRouter hint', () => {
      const error = {
        provider: 'openrouter',
        type: 'auth' as const,
        message: 'Invalid API key',
        httpStatus: 401,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openrouter',
        type: 'auth',
        message: 'Invalid API key',
        httpStatus: 401,
        hint: expect.stringContaining('OPENROUTER_API_KEY'),
      });
    });

    it('should normalize 429 rate limit errors', () => {
      const error = {
        provider: 'openrouter',
        type: 'rate_limit' as const,
        message: 'Rate limit exceeded',
        httpStatus: 429,
        retryable: true,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openrouter',
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        httpStatus: 429,
        hint: expect.stringContaining('rate limit'),
      });
    });

    it('should normalize 402 payment required errors', () => {
      const error = {
        provider: 'openrouter',
        type: 'bad_request' as const,
        message: 'Insufficient credits',
        httpStatus: 402,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openrouter',
        type: 'auth',
        message: 'Insufficient credits',
        httpStatus: 402,
        hint: expect.stringContaining('credits'),
      });
    });

    it('should normalize 400 bad request errors', () => {
      const error = {
        provider: 'openrouter',
        type: 'bad_request' as const,
        message: 'Invalid model',
        httpStatus: 400,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openrouter',
        type: 'bad_request',
        message: 'Invalid model',
        httpStatus: 400,
        hint: expect.stringContaining('request parameters'),
      });
    });

    it('should use base normalization for other errors', () => {
      const error = new Error('Generic error');

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openrouter',
        type: 'internal',
        message: 'Generic error',
        retryable: false,
      });
    });
  });

  describe('OpenRouter-specific features', () => {
    it('should include required OpenRouter headers in all requests', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://github.com/metisse-ai/entole',
            'X-Title': 'Entole CLI',
            Authorization: expect.stringContaining('Bearer'),
            'Content-Type': 'application/json',
            'User-Agent': 'entole/1.0.0',
          }),
        })
      );
    });

    it('should correctly identify model capabilities', async () => {
      const mockResponse = {
        data: [
          { id: 'openai/gpt-4-vision-preview', name: 'GPT-4 Vision' },
          { id: 'text-embedding-ada-002', name: 'Ada Embeddings' },
          { id: 'openai/whisper-1', name: 'Whisper' },
          { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const models = await adapter.getModels();

      // Vision model should have image capability
      const visionModel = models.find(
        (m) => m.id === 'openai/gpt-4-vision-preview'
      );
      expect(visionModel?.capabilities.image).toBe(true);
      expect(visionModel?.capabilities.chat).toBe(true);

      // Embedding model should only have embeddings capability
      const embeddingModel = models.find(
        (m) => m.id === 'text-embedding-ada-002'
      );
      expect(embeddingModel?.capabilities.embeddings).toBe(true);
      expect(embeddingModel?.capabilities.chat).toBe(false);

      // Whisper should not be chat
      const whisperModel = models.find((m) => m.id === 'openai/whisper-1');
      expect(whisperModel?.capabilities.chat).toBe(false);

      // Claude should have tools capability
      const claudeModel = models.find(
        (m) => m.id === 'anthropic/claude-3-opus'
      );
      expect(claudeModel?.capabilities.tools).toBe(true);
    });
  });
});
