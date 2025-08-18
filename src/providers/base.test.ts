/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for base provider adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseProviderAdapter } from './base.js';
import type { CapabilityFlags } from '../types.js';

// Mock implementation for testing
class TestProviderAdapter extends BaseProviderAdapter {
  readonly key = 'test';
  readonly label = 'Test Provider';
  readonly capabilities: CapabilityFlags = {
    chat: true,
    embeddings: true,
    image: false,
    tools: false,
  };
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BaseProviderAdapter', () => {
  let adapter: TestProviderAdapter;

  beforeEach(() => {
    adapter = new TestProviderAdapter();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('default implementations', () => {
    it('should throw not implemented error for invokeChat', async () => {
      await expect(adapter.invokeChat({ messages: [] })).rejects.toEqual({
        provider: 'test',
        type: 'not_implemented',
        message: 'chat is not yet implemented for test',
        hint: 'The test adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });

    it('should throw not implemented error for invokeChatStream', async () => {
      const generator = adapter.invokeChatStream({ messages: [] });

      // First call should yield the dummy value
      const firstResult = await generator.next();
      expect(firstResult.value).toEqual({ delta: '', done: true });
      expect(firstResult.done).toBe(false);

      // Second call should throw the error
      try {
        await generator.next();
        expect.fail('Expected generator to throw');
      } catch (error) {
        expect(error).toEqual({
          provider: 'test',
          type: 'not_implemented',
          message: 'streaming chat is not yet implemented for test',
          hint: 'The test adapter is a placeholder. Consider using a different provider.',
          retryable: false,
        });
      }
    });

    it('should throw not implemented error for invokeEmbeddings', async () => {
      await expect(adapter.invokeEmbeddings({ input: 'test' })).rejects.toEqual(
        {
          provider: 'test',
          type: 'not_implemented',
          message: 'embeddings is not yet implemented for test',
          hint: 'The test adapter is a placeholder. Consider using a different provider.',
          retryable: false,
        }
      );
    });

    it('should return empty array for getModels', async () => {
      const models = await adapter.getModels();
      expect(models).toEqual([]);
    });
  });

  describe('normalizeError', () => {
    it('should normalize Response objects', () => {
      // Create a mock object that looks like a Response
      const response = Object.create(Response.prototype);
      Object.defineProperty(response, 'status', {
        value: 401,
        writable: false,
      });
      Object.defineProperty(response, 'statusText', {
        value: 'Unauthorized',
        writable: false,
      });

      const error = adapter.normalizeError(response);

      expect(error).toEqual({
        provider: 'test',
        type: 'auth',
        message: 'HTTP 401: Unauthorized',
        hint: 'Check your TEST_API_KEY environment variable',
        httpStatus: 401,
        retryable: false,
      });
    });

    it('should normalize fetch TypeError', () => {
      const error = new TypeError('fetch failed');
      const normalized = adapter.normalizeError(error);

      expect(normalized).toEqual({
        provider: 'test',
        type: 'network',
        message: 'fetch failed',
        hint: 'Check your internet connection and provider endpoint',
        retryable: true,
      });
    });

    it('should pass through already normalized errors', () => {
      const normalizedError = {
        provider: 'test',
        type: 'rate_limit' as const,
        message: 'Rate limited',
        retryable: true,
      };

      const result = adapter.normalizeError(normalizedError);
      expect(result).toBe(normalizedError);
    });

    it('should normalize generic Error objects', () => {
      const error = new Error('Something went wrong');
      const normalized = adapter.normalizeError(error);

      expect(normalized).toEqual({
        provider: 'test',
        type: 'internal',
        message: 'Something went wrong',
        retryable: false,
      });
    });

    it('should handle unknown error types', () => {
      const error = { unknown: 'error' };
      const normalized = adapter.normalizeError(error);

      expect(normalized).toEqual({
        provider: 'test',
        type: 'internal',
        message: 'An unknown error occurred',
        retryable: false,
      });
    });
  });

  describe('makeRequest', () => {
    it('should make successful HTTP request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await adapter['makeRequest'](
        'https://api.example.com/test'
      );

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        headers: {
          'User-Agent': 'entole/1.0.0',
        },
      });
      expect(response).toBe(mockResponse);
    });

    it('should merge custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      await adapter['makeRequest']('https://api.example.com/test', {
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        headers: {
          'User-Agent': 'entole/1.0.0',
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('{"error": "Not found"}'),
      } as Response;
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(
        adapter['makeRequest']('https://api.example.com/test')
      ).rejects.toEqual({
        provider: 'test',
        type: 'bad_request',
        message: 'HTTP 404: Not Found',
        hint: 'Check your request parameters and model availability',
        httpStatus: 404,
        retryable: false,
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(
        adapter['makeRequest']('https://api.example.com/test')
      ).rejects.toEqual({
        provider: 'test',
        type: 'network',
        message: 'fetch failed',
        hint: 'Check your internet connection and provider endpoint',
        retryable: true,
      });
    });
  });

  describe('validateRequired', () => {
    it('should pass validation when all required fields are present', () => {
      const params = { model: 'test-model', messages: [] };

      expect(() => {
        adapter['validateRequired'](params, ['model', 'messages']);
      }).not.toThrow();
    });

    it('should throw error when required fields are missing', () => {
      const params = { messages: [] };

      expect(() => {
        adapter['validateRequired'](params, ['model']);
      }).toThrow('Missing required parameters: model');
    });

    it('should throw error for multiple missing fields', () => {
      const params = {};

      expect(() => {
        adapter['validateRequired'](params, ['model', 'messages']);
      }).toThrow('Missing required parameters: model, messages');
    });
  });

  describe('parseServerSentEvents', () => {
    it('should parse server-sent events from stream', async () => {
      // Mock ReadableStream for testing
      const mockStream = {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(Buffer.from('data: {"chunk": 1}\n\n')),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(Buffer.from('data: {"chunk": 2}\n\n')),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(Buffer.from('data: [DONE]\n\n')),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      } as unknown as ReadableStream<Uint8Array>;

      const events = [];
      for await (const event of adapter['parseServerSentEvents'](mockStream)) {
        events.push(event);
      }

      expect(events).toEqual(['{"chunk": 1}', '{"chunk": 2}']);
    });

    it('should handle partial chunks across reads', async () => {
      // Mock ReadableStream for testing
      const mockStream = {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(Buffer.from('data: {"par')),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(Buffer.from('tial": true}\n\n')),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new Uint8Array(Buffer.from('data: [DONE]\n\n')),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          releaseLock: vi.fn(),
        }),
      } as unknown as ReadableStream<Uint8Array>;

      const events = [];
      for await (const event of adapter['parseServerSentEvents'](mockStream)) {
        events.push(event);
      }

      expect(events).toEqual(['{"partial": true}']);
    });
  });
});
