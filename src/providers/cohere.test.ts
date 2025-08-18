/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for Cohere provider adapter stub
 */

import { describe, it, expect } from 'vitest';
import { CohereAdapter } from './cohere.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

describe('CohereAdapter', () => {
  const adapter = new CohereAdapter();

  describe('basic properties', () => {
    it('should have correct key and label', () => {
      expect(adapter.key).toBe('cohere');
      expect(adapter.label).toBe('Cohere');
    });

    it('should have all capabilities set to false', () => {
      expect(adapter.capabilities).toEqual({
        chat: false,
        embeddings: false,
        image: false,
        tools: false,
      });
    });
  });

  describe('invokeChat', () => {
    it('should throw not_implemented error', async () => {
      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(adapter.invokeChat(params)).rejects.toMatchObject({
        provider: 'cohere',
        type: 'not_implemented',
        message: 'chat is not yet implemented for cohere',
        hint: 'The cohere adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });
  });

  describe('invokeChatStream', () => {
    it('should throw not_implemented error', async () => {
      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const generator = adapter.invokeChatStream(params);

      // The generator should yield once and then throw
      const firstResult = await generator.next();
      expect(firstResult.value).toEqual({ delta: '', done: true });

      await expect(generator.next()).rejects.toMatchObject({
        provider: 'cohere',
        type: 'not_implemented',
        message: 'streaming chat is not yet implemented for cohere',
        hint: 'The cohere adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });
  });

  describe('invokeEmbeddings', () => {
    it('should throw not_implemented error', async () => {
      const params: EmbeddingParams = {
        input: 'Hello world',
      };

      await expect(adapter.invokeEmbeddings(params)).rejects.toMatchObject({
        provider: 'cohere',
        type: 'not_implemented',
        message: 'embeddings is not yet implemented for cohere',
        hint: 'The cohere adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });
  });

  describe('getModels', () => {
    it('should return empty array', async () => {
      const models = await adapter.getModels();
      expect(models).toEqual([]);
    });
  });

  describe('normalizeError', () => {
    it('should normalize generic errors', () => {
      const error = new Error('Test error');
      const normalized = adapter.normalizeError(error);

      expect(normalized).toMatchObject({
        provider: 'cohere',
        type: 'internal',
        message: 'Test error',
        retryable: false,
      });
    });

    it('should pass through already normalized errors', () => {
      const normalizedError = {
        provider: 'cohere',
        type: 'auth' as const,
        message: 'Authentication failed',
        retryable: false,
      };

      const result = adapter.normalizeError(normalizedError);
      expect(result).toEqual(normalizedError);
    });
  });
});
