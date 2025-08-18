/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for Mistral provider adapter stub
 *
 * This test suite validates the Mistral provider adapter stub functionality including:
 * - Proper initialization with configuration options
 * - Consistent "not implemented" error responses for all operations
 * - Correct capability flags (all set to false)
 * - Error normalization and provider identification
 * - Interface compliance with ProviderAdapter contract
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MistralAdapter } from './mistral.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

describe('MistralAdapter', () => {
  let adapter: MistralAdapter;

  beforeEach(() => {
    adapter = new MistralAdapter();
  });

  describe('constructor and properties', () => {
    it('should initialize with correct provider metadata', () => {
      expect(adapter.key).toBe('mistral');
      expect(adapter.label).toBe('Mistral');
      expect(adapter.capabilities).toEqual({
        chat: false,
        embeddings: false,
        image: false,
        tools: false,
      });
    });

    it('should accept configuration options without throwing', () => {
      const config = {
        apiKey: 'test-key',
        baseUrl: 'https://api.mistral.ai',
        defaultModel: 'mistral-large',
      };

      expect(() => new MistralAdapter(config)).not.toThrow();

      const configuredAdapter = new MistralAdapter(config);
      expect(configuredAdapter.key).toBe('mistral');
    });

    it('should work with empty configuration', () => {
      expect(() => new MistralAdapter({})).not.toThrow();
      expect(() => new MistralAdapter()).not.toThrow();
    });
  });

  describe('invokeChat', () => {
    const mockChatParams: ChatParams = {
      messages: [{ role: 'user', content: 'Hello, world!' }],
      temperature: 0.7,
      max_tokens: 100,
    };

    it('should throw not implemented error', async () => {
      await expect(adapter.invokeChat(mockChatParams)).rejects.toEqual({
        provider: 'mistral',
        type: 'not_implemented',
        message: 'chat is not yet implemented for mistral',
        hint: 'The mistral adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });

    it('should throw not implemented error regardless of parameters', async () => {
      const minimalParams: ChatParams = {
        messages: [{ role: 'user', content: 'test' }],
      };

      await expect(adapter.invokeChat(minimalParams)).rejects.toMatchObject({
        provider: 'mistral',
        type: 'not_implemented',
        retryable: false,
      });
    });
  });

  describe('invokeChatStream', () => {
    const mockChatParams: ChatParams = {
      messages: [{ role: 'user', content: 'Tell me a story' }],
    };

    it('should yield dummy chunk then throw not implemented error', async () => {
      const generator = adapter.invokeChatStream(mockChatParams);

      // First call should yield the dummy value
      const firstResult = await generator.next();
      expect(firstResult.value).toEqual({ delta: '', done: true });
      expect(firstResult.done).toBe(false);

      // Second call should throw the error
      await expect(generator.next()).rejects.toEqual({
        provider: 'mistral',
        type: 'not_implemented',
        message: 'streaming chat is not yet implemented for mistral',
        hint: 'The mistral adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });

    it('should handle async iteration pattern', async () => {
      const generator = adapter.invokeChatStream(mockChatParams);

      try {
        const chunks = [];
        for await (const chunk of generator) {
          chunks.push(chunk);
        }
        expect.fail('Expected generator to throw');
      } catch (error) {
        expect(error).toMatchObject({
          provider: 'mistral',
          type: 'not_implemented',
          message: 'streaming chat is not yet implemented for mistral',
        });
      }
    });
  });

  describe('invokeEmbeddings', () => {
    const mockEmbeddingParams: EmbeddingParams = {
      input: 'Hello, world!',
      model: 'mistral-embed',
    };

    it('should throw not implemented error', async () => {
      await expect(
        adapter.invokeEmbeddings(mockEmbeddingParams)
      ).rejects.toEqual({
        provider: 'mistral',
        type: 'not_implemented',
        message: 'embeddings is not yet implemented for mistral',
        hint: 'The mistral adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });

    it('should throw not implemented error for array input', async () => {
      const arrayParams: EmbeddingParams = {
        input: ['First text', 'Second text'],
      };

      await expect(adapter.invokeEmbeddings(arrayParams)).rejects.toMatchObject(
        {
          provider: 'mistral',
          type: 'not_implemented',
          retryable: false,
        }
      );
    });
  });

  describe('getModels', () => {
    it('should return empty array', async () => {
      const models = await adapter.getModels();
      expect(models).toEqual([]);
      expect(Array.isArray(models)).toBe(true);
    });
  });

  describe('normalizeError', () => {
    it('should normalize generic errors with provider context', () => {
      const error = new Error('Generic error');
      const normalized = adapter.normalizeError(error);

      expect(normalized).toEqual({
        provider: 'mistral',
        type: 'internal',
        message: 'Generic error',
        retryable: false,
      });
    });

    it('should pass through already normalized errors', () => {
      const normalizedError = {
        provider: 'mistral',
        type: 'rate_limit' as const,
        message: 'Rate limited',
        retryable: true,
      };

      const result = adapter.normalizeError(normalizedError);
      expect(result).toBe(normalizedError);
    });

    it('should handle unknown error types', () => {
      const error = { unknown: 'error' };
      const normalized = adapter.normalizeError(error);

      expect(normalized).toEqual({
        provider: 'mistral',
        type: 'internal',
        message: 'An unknown error occurred',
        retryable: false,
      });
    });
  });

  describe('provider interface compliance', () => {
    it('should implement all required ProviderAdapter methods', () => {
      expect(typeof adapter.invokeChat).toBe('function');
      expect(typeof adapter.invokeChatStream).toBe('function');
      expect(typeof adapter.invokeEmbeddings).toBe('function');
      expect(typeof adapter.getModels).toBe('function');
      expect(typeof adapter.normalizeError).toBe('function');
    });

    it('should have correct property types', () => {
      expect(typeof adapter.key).toBe('string');
      expect(typeof adapter.label).toBe('string');
      expect(typeof adapter.capabilities).toBe('object');
      expect(adapter.capabilities).toHaveProperty('chat');
      expect(adapter.capabilities).toHaveProperty('embeddings');
      expect(adapter.capabilities).toHaveProperty('image');
      expect(adapter.capabilities).toHaveProperty('tools');
    });
  });

  describe('error consistency', () => {
    it('should return consistent error structure across all methods', async () => {
      const chatError = await adapter
        .invokeChat({ messages: [] })
        .catch((e) => e);
      const embeddingError = await adapter
        .invokeEmbeddings({ input: 'test' })
        .catch((e) => e);

      // Both should have the same error structure
      expect(chatError).toMatchObject({
        provider: 'mistral',
        type: 'not_implemented',
        retryable: false,
      });

      expect(embeddingError).toMatchObject({
        provider: 'mistral',
        type: 'not_implemented',
        retryable: false,
      });

      // Both should have helpful hints
      expect(chatError.hint).toContain('placeholder');
      expect(embeddingError.hint).toContain('placeholder');
    });

    it('should include provider-specific hints in error messages', async () => {
      const error = await adapter.invokeChat({ messages: [] }).catch((e) => e);

      expect(error.hint).toContain('mistral adapter');
      expect(error.hint).toContain('Consider using a different provider');
    });
  });

  describe('capability flags', () => {
    it('should have all capabilities set to false', () => {
      expect(adapter.capabilities.chat).toBe(false);
      expect(adapter.capabilities.embeddings).toBe(false);
      expect(adapter.capabilities.image).toBe(false);
      expect(adapter.capabilities.tools).toBe(false);
    });

    it('should be consistent with thrown errors', async () => {
      // Since chat capability is false, chat should throw not implemented
      expect(adapter.capabilities.chat).toBe(false);
      await expect(adapter.invokeChat({ messages: [] })).rejects.toMatchObject({
        type: 'not_implemented',
      });

      // Since embeddings capability is false, embeddings should throw not implemented
      expect(adapter.capabilities.embeddings).toBe(false);
      await expect(
        adapter.invokeEmbeddings({ input: 'test' })
      ).rejects.toMatchObject({
        type: 'not_implemented',
      });
    });
  });
});
