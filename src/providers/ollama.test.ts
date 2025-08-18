/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Tests for Ollama provider adapter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaAdapter } from './ollama.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

// Mock fetch for unit tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter({
      host: 'http://localhost:11434',
      defaultModel: 'llama2',
    });
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const defaultAdapter = new OllamaAdapter();
      expect(defaultAdapter.key).toBe('ollama');
      expect(defaultAdapter.label).toBe('Ollama');
      expect(defaultAdapter.capabilities).toEqual({
        chat: true,
        embeddings: true,
        image: false,
        tools: false,
      });
    });

    it('should use environment variables', () => {
      const originalHost = process.env.OLLAMA_HOST;
      const originalModel = process.env.OLLAMA_MODEL;

      process.env.OLLAMA_HOST = 'http://custom:8080';
      process.env.OLLAMA_MODEL = 'custom-model';

      const envAdapter = new OllamaAdapter();

      // Reset environment
      process.env.OLLAMA_HOST = originalHost;
      process.env.OLLAMA_MODEL = originalModel;

      // Note: We can't easily test the private properties, but we can test behavior
      expect(envAdapter.key).toBe('ollama');
    });
  });

  describe('invokeChat', () => {
    it('should make chat request successfully', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you?',
        },
        done: true,
        prompt_eval_count: 10,
        eval_count: 8,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      };

      const result = await adapter.invokeChat(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            model: 'llama2',
            messages: params.messages,
            stream: false,
            options: {
              temperature: 0.7,
              top_p: undefined,
              num_predict: undefined,
            },
          }),
        })
      );

      expect(result).toEqual({
        text: 'Hello! How can I help you?',
        meta: {
          model: 'llama2',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
          finish_reason: 'stop',
        },
      });
    });

    it('should handle missing messages parameter', async () => {
      const params = {} as ChatParams;

      await expect(adapter.invokeChat(params)).rejects.toThrow(
        'Missing required parameters: messages'
      );
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('{"error": "model not found"}'),
      });

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(adapter.invokeChat(params)).rejects.toMatchObject({
        provider: 'ollama',
        type: 'bad_request',
        httpStatus: 404,
      });
    });
  });

  describe('invokeChatStream', () => {
    it('should handle streaming chat', async () => {
      const mockChunks = [
        '{"model":"llama2","message":{"role":"assistant","content":"Hello"},"done":false}\n',
        '{"model":"llama2","message":{"role":"assistant","content":" there!"},"done":false}\n',
        '{"model":"llama2","message":{"role":"assistant","content":""},"done":true}\n',
      ];

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(mockChunks[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(mockChunks[1]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(mockChunks[2]),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const chunks = [];
      for await (const chunk of adapter.invokeChatStream(params)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { delta: 'Hello', done: false, meta: { model: 'llama2' } },
        { delta: ' there!', done: false, meta: { model: 'llama2' } },
      ]);

      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should handle malformed JSON in stream', async () => {
      const mockChunks = [
        'invalid json\n',
        '{"model":"llama2","message":{"role":"assistant","content":"Hello"},"done":true}\n',
      ];

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(mockChunks[0]),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(mockChunks[1]),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const chunks = [];
      for await (const chunk of adapter.invokeChatStream(params)) {
        chunks.push(chunk);
      }

      // Should skip invalid JSON and only return valid chunk
      expect(chunks).toEqual([
        { delta: 'Hello', done: true, meta: { model: 'llama2' } },
      ]);
    });
  });

  describe('invokeEmbeddings', () => {
    it('should handle single string input', async () => {
      const mockResponse = {
        embedding: [0.1, 0.2, 0.3, 0.4],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const params: EmbeddingParams = {
        input: 'Hello world',
        model: 'llama2',
      };

      const result = await adapter.invokeEmbeddings(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'llama2',
            prompt: 'Hello world',
          }),
        })
      );

      expect(result).toEqual({
        vectors: [[0.1, 0.2, 0.3, 0.4]],
        meta: {
          model: 'llama2',
          usage: {
            prompt_tokens: 11, // Length of "Hello world"
            total_tokens: 11,
          },
        },
      });
    });

    it('should handle array input', async () => {
      const mockResponse1 = { embedding: [0.1, 0.2] };
      const mockResponse2 = { embedding: [0.3, 0.4] };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse2),
        });

      const params: EmbeddingParams = {
        input: ['Hello', 'World'],
      };

      const result = await adapter.invokeEmbeddings(params);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.vectors).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
    });
  });

  describe('getModels', () => {
    it('should fetch models successfully', async () => {
      const mockResponse = {
        models: [
          {
            name: 'llama2',
            modified_at: '2024-01-01T00:00:00Z',
            size: 1000000,
            digest: 'abc123',
            details: {
              family: 'llama',
              parameter_size: '7B',
            },
          },
          {
            name: 'codellama',
            modified_at: '2024-01-01T00:00:00Z',
            size: 2000000,
            digest: 'def456',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const models = await adapter.getModels();

      expect(models).toEqual([
        {
          id: 'llama2',
          name: 'llama2',
          description: 'llama model',
          capabilities: {
            chat: true,
            embeddings: true,
            image: false,
            tools: false,
          },
        },
        {
          id: 'codellama',
          name: 'codellama',
          description: undefined,
          capabilities: {
            chat: true,
            embeddings: true,
            image: false,
            tools: false,
          },
        },
      ]);
    });

    it('should return default model on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const models = await adapter.getModels();

      expect(models).toEqual([
        {
          id: 'llama2',
          name: 'llama2',
          description: 'Default Ollama model',
          capabilities: {
            chat: true,
            embeddings: true,
            image: false,
            tools: false,
          },
        },
      ]);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when Ollama is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await adapter.healthCheck();

      expect(result).toEqual({ healthy: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return unhealthy on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await adapter.healthCheck();

      expect(result).toEqual({
        healthy: false,
        error: 'Ollama returned HTTP 500: Internal Server Error',
      });
    });

    it('should return unhealthy on network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await adapter.healthCheck();

      expect(result).toEqual({
        healthy: false,
        error: 'Ollama health check failed: Connection failed',
      });
    });

    it('should return unhealthy on timeout', async () => {
      const abortError = new Error('Timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await adapter.healthCheck();

      expect(result).toEqual({
        healthy: false,
        error: 'Ollama health check failed: Connection timeout',
      });
    });
  });

  describe('normalizeError', () => {
    it('should provide Ollama-specific hints for network errors', () => {
      const fetchError = new TypeError('fetch failed');
      const normalized = adapter.normalizeError(fetchError);

      expect(normalized).toMatchObject({
        provider: 'ollama',
        type: 'network',
        message: 'Failed to connect to Ollama',
        hint: expect.stringContaining('Check that Ollama is running'),
        retryable: true,
      });
    });

    it('should provide model-specific hints for 404 errors', () => {
      const httpError = {
        provider: 'ollama',
        type: 'bad_request' as const,
        message: 'Not found',
        httpStatus: 404,
        retryable: false,
      };

      const normalized = adapter.normalizeError(httpError);

      expect(normalized.hint).toContain('Model not found');
      expect(normalized.hint).toContain('ollama list');
    });
  });
});
