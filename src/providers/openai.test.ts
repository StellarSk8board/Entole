/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for OpenAI provider adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIAdapter } from './openai.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up adapter with test API key
    adapter = new OpenAIAdapter({
      apiKey: 'sk-test-key-12345678901234567890123456789012',
      baseUrl: 'https://api.openai.com',
      defaultModel: 'gpt-4o-mini',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config = {
        apiKey: 'test-key',
        baseUrl: 'https://custom.openai.com',
        defaultModel: 'gpt-4',
      };

      const customAdapter = new OpenAIAdapter(config);

      expect(customAdapter.key).toBe('openai');
      expect(customAdapter.label).toBe('OpenAI');
      expect(customAdapter.capabilities).toEqual({
        chat: true,
        embeddings: true,
        image: true,
        tools: true,
      });
    });

    it('should use environment variables as fallback', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-test-key';

      const envAdapter = new OpenAIAdapter();

      expect(envAdapter.key).toBe('openai');

      process.env.OPENAI_API_KEY = originalEnv;
    });

    it('should not throw error during construction when no API key is provided', () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(() => new OpenAIAdapter()).not.toThrow();

      process.env.OPENAI_API_KEY = originalEnv;
    });
  });

  describe('invokeChat', () => {
    const mockChatParams: ChatParams = {
      messages: [{ role: 'user', content: 'Hello, world!' }],
      temperature: 0.7,
      max_tokens: 100,
    };

    it('should successfully invoke chat completion', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4o-mini',
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
          model: 'gpt-4o-mini',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 9,
            total_tokens: 19,
          },
          finish_reason: 'stop',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization:
              'Bearer sk-test-key-12345678901234567890123456789012',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            model: 'gpt-4o-mini',
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
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response from GPT-4',
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
        model: 'gpt-4',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4"'),
        })
      );
    });

    it('should handle API errors', async () => {
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
        provider: 'openai',
        type: 'auth',
        message: 'Invalid API key',
        httpStatus: 401,
        hint: expect.stringContaining('OPENAI_API_KEY'),
      });
    });

    it('should handle empty choices', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4o-mini',
        choices: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(adapter.invokeChat(mockChatParams)).rejects.toThrow(
        'No choices returned from OpenAI API'
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
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Once"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":" a"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
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
            model: 'gpt-4o-mini',
            finish_reason: undefined,
          },
        },
        {
          delta: ' upon',
          done: false,
          meta: {
            model: 'gpt-4o-mini',
            finish_reason: undefined,
          },
        },
        {
          delta: ' a',
          done: false,
          meta: {
            model: 'gpt-4o-mini',
            finish_reason: undefined,
          },
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":true'),
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
        provider: 'openai',
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

    it('should successfully invoke embeddings', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            object: 'embedding',
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: 'text-embedding-3-small',
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
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 3,
            total_tokens: 3,
          },
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'text-embedding-3-small',
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
        model: 'text-embedding-3-small',
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
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          body: expect.stringContaining('"model":"text-embedding-3-large"'),
        })
      );
    });

    it('should handle empty embeddings response', async () => {
      const mockResponse = {
        object: 'list',
        data: [],
        model: 'text-embedding-3-small',
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
      ).rejects.toThrow('No embeddings returned from OpenAI API');
    });

    it('should validate required parameters', async () => {
      await expect(
        adapter.invokeEmbeddings({} as EmbeddingParams)
      ).rejects.toThrow('Missing required parameters: input');
    });
  });

  describe('getModels', () => {
    it('should successfully fetch models from API', async () => {
      const mockResponse = {
        object: 'list',
        data: [
          {
            id: 'gpt-4o',
            object: 'model',
            created: 1677610602,
            owned_by: 'openai',
          },
          {
            id: 'text-embedding-3-small',
            object: 'model',
            created: 1677610602,
            owned_by: 'openai',
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
          id: 'gpt-4o',
          name: 'gpt-4o',
          description: 'OpenAI gpt-4o model',
          capabilities: {
            chat: true,
            embeddings: false,
            image: true,
            tools: true,
          },
        },
        {
          id: 'text-embedding-3-small',
          name: 'text-embedding-3-small',
          description: 'OpenAI text-embedding-3-small model',
          capabilities: {
            chat: false,
            embeddings: true,
            image: false,
            tools: false,
          },
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization:
              'Bearer sk-test-key-12345678901234567890123456789012',
          }),
        })
      );
    });

    it('should return known models as fallback when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const models = await adapter.getModels();

      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'gpt-4o',
            name: 'GPT-4o',
          }),
          expect.objectContaining({
            id: 'text-embedding-3-small',
            name: 'Text Embedding 3 Small',
          }),
        ])
      );
    });
  });

  describe('normalizeError', () => {
    it('should normalize 401 authentication errors', () => {
      const error = {
        provider: 'openai',
        type: 'auth' as const,
        message: 'Invalid API key',
        httpStatus: 401,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openai',
        type: 'auth',
        message: 'Invalid API key',
        httpStatus: 401,
        hint: expect.stringContaining('OPENAI_API_KEY'),
      });
    });

    it('should normalize 429 rate limit errors', () => {
      const error = {
        provider: 'openai',
        type: 'rate_limit' as const,
        message: 'Rate limit exceeded',
        httpStatus: 429,
        retryable: true,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openai',
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        httpStatus: 429,
        hint: expect.stringContaining('rate limit'),
      });
    });

    it('should normalize 400 bad request errors', () => {
      const error = {
        provider: 'openai',
        type: 'bad_request' as const,
        message: 'Invalid model',
        httpStatus: 400,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'openai',
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
        provider: 'openai',
        type: 'internal',
        message: 'Generic error',
        retryable: false,
      });
    });
  });
});
