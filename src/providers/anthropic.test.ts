/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for Anthropic provider adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicAdapter } from './anthropic.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up adapter with test API key
    adapter = new AnthropicAdapter({
      apiKey:
        'sk-ant-api03-test-key-12345678901234567890123456789012345678901234567890123456789012345678901234567890123456',
      defaultModel: 'claude-3-5-sonnet-20241022',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config = {
        apiKey: 'test-key',
        defaultModel: 'claude-3-opus-20240229',
      };

      const customAdapter = new AnthropicAdapter(config);

      expect(customAdapter.key).toBe('anthropic');
      expect(customAdapter.label).toBe('Anthropic');
      expect(customAdapter.capabilities).toEqual({
        chat: true,
        embeddings: false,
        image: true,
        tools: true,
      });
    });

    it('should use environment variables as fallback', () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'env-test-key';

      const envAdapter = new AnthropicAdapter();

      expect(envAdapter.key).toBe('anthropic');

      process.env.ANTHROPIC_API_KEY = originalEnv;
    });

    it('should not throw error during construction when no API key is provided', () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new AnthropicAdapter()).not.toThrow();

      process.env.ANTHROPIC_API_KEY = originalEnv;
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
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello! How can I help you today?',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 9,
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
          model: 'claude-3-5-sonnet-20241022',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 9,
            total_tokens: 19,
          },
          finish_reason: 'end_turn',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key':
              'sk-ant-api03-test-key-12345678901234567890123456789012345678901234567890123456789012345678901234567890123456',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          }),
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 100,
            messages: [{ role: 'user', content: 'Hello, world!' }],
            temperature: 0.7,
            stream: false,
          }),
        })
      );
    });

    it('should handle system messages correctly', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I understand the instructions.',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 20,
          output_tokens: 5,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: expect.stringContaining(
            '"system":"You are a helpful assistant."'
          ),
        })
      );
    });

    it('should handle multiple system messages', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I understand both instructions.',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 30,
          output_tokens: 5,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'system', content: 'Be concise.' },
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: expect.stringContaining(
            '"system":"You are helpful.\\n\\nBe concise."'
          ),
        })
      );
    });

    it('should ensure messages start with user message', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello there!',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 15,
          output_tokens: 3,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        messages: [
          { role: 'assistant', content: 'Previous response' },
          { role: 'user', content: 'New question' },
        ],
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
      expect(requestBody.messages[1]).toEqual({
        role: 'assistant',
        content: 'Previous response',
      });
    });

    it('should use custom model when provided', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Response from Claude Opus',
          },
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        ...mockChatParams,
        model: 'claude-3-opus-20240229',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          body: expect.stringContaining('"model":"claude-3-opus-20240229"'),
        })
      );
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        type: 'error',
        error: {
          type: 'authentication_error',
          message: 'Invalid API key',
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
        provider: 'anthropic',
        type: 'auth',
        httpStatus: 401,
        hint: expect.stringContaining('ANTHROPIC_API_KEY'),
      });
    });

    it('should handle empty content', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(adapter.invokeChat(mockChatParams)).rejects.toThrow(
        'No content returned from Anthropic API'
      );
    });

    it('should handle multiple content blocks', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'First part. ',
          },
          {
            type: 'text',
            text: 'Second part.',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 8,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await adapter.invokeChat(mockChatParams);

      expect(result.text).toBe('First part. Second part.');
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
        'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":0}}}\n\n',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Once"}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" upon"}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" a"}}\n\n',
        'data: {"type":"content_block_stop","index":0}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":3}}\n\n',
        'data: {"type":"message_stop"}\n\n',
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
            model: 'claude-3-5-sonnet-20241022',
          },
        },
        {
          delta: ' upon',
          done: false,
          meta: {
            model: 'claude-3-5-sonnet-20241022',
          },
        },
        {
          delta: ' a',
          done: false,
          meta: {
            model: 'claude-3-5-sonnet-20241022',
          },
        },
        {
          delta: '',
          done: true,
          meta: {
            model: 'claude-3-5-sonnet-20241022',
            usage: {
              completion_tokens: 3,
            },
            finish_reason: 'end_turn',
          },
        },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":true'),
        })
      );
    });

    it('should handle streaming errors', async () => {
      const errorResponse = {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'Model not found',
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
        provider: 'anthropic',
        type: 'bad_request',
        httpStatus: 404,
      });
    });

    it('should handle malformed JSON in stream', async () => {
      const mockChunks = [
        'data: {"type":"message_start","message":{"model":"claude-3-5-sonnet-20241022"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
        'data: invalid-json\n\n',
        'data: {"type":"message_stop"}\n\n',
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
      expect(chunks).toHaveLength(2); // Hello chunk + final stop chunk
      expect(chunks[0].delta).toBe('Hello');
    });

    it('should handle missing response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const generator = adapter.invokeChatStream(mockChatParams);

      await expect(generator.next()).rejects.toThrow(
        'Response body is not available for streaming'
      );
    });
  });

  describe('invokeEmbeddings', () => {
    const mockEmbeddingParams: EmbeddingParams = {
      input: 'Hello, world!',
    };

    it('should throw not implemented error', async () => {
      await expect(
        adapter.invokeEmbeddings(mockEmbeddingParams)
      ).rejects.toMatchObject({
        provider: 'anthropic',
        type: 'not_implemented',
        message: 'Embeddings are not supported by Anthropic',
        hint: 'Use OpenAI, OpenRouter, or Ollama for embedding capabilities',
        retryable: false,
      });
    });
  });

  describe('getModels', () => {
    it('should return known Anthropic models', async () => {
      const models = await adapter.getModels();

      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            capabilities: {
              chat: true,
              embeddings: false,
              image: true,
              tools: true,
            },
          }),
          expect.objectContaining({
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            capabilities: {
              chat: true,
              embeddings: false,
              image: true,
              tools: true,
            },
          }),
        ])
      );

      expect(models.length).toBeGreaterThan(0);
      expect(
        models.every((model) => model.capabilities.embeddings === false)
      ).toBe(true);
    });
  });

  describe('normalizeError', () => {
    it('should normalize 401 authentication errors', () => {
      const error = {
        provider: 'anthropic',
        type: 'auth' as const,
        message: 'Invalid API key',
        httpStatus: 401,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'anthropic',
        type: 'auth',
        message: 'Invalid API key',
        httpStatus: 401,
        hint: expect.stringContaining('ANTHROPIC_API_KEY'),
      });
    });

    it('should normalize 429 rate limit errors', () => {
      const error = {
        provider: 'anthropic',
        type: 'rate_limit' as const,
        message: 'Rate limit exceeded',
        httpStatus: 429,
        retryable: true,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'anthropic',
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        httpStatus: 429,
        hint: expect.stringContaining('rate limit'),
      });
    });

    it('should normalize 400 bad request errors', () => {
      const error = {
        provider: 'anthropic',
        type: 'bad_request' as const,
        message: 'Invalid model',
        httpStatus: 400,
        retryable: false,
      };

      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'anthropic',
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
        provider: 'anthropic',
        type: 'internal',
        message: 'Generic error',
        retryable: false,
      });
    });
  });

  describe('message conversion', () => {
    it('should handle conversation with alternating messages', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Response',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 20,
          output_tokens: 1,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.invokeChat({
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Second question' },
        ],
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages).toEqual([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
      ]);
    });
  });
});
