/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Integration tests for Ollama provider adapter
 * These tests require a running Ollama instance and will be skipped if unavailable
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { OllamaAdapter } from './ollama.js';
import type { ChatParams, EmbeddingParams } from '../types.js';

describe('OllamaAdapter Integration Tests', () => {
  let adapter: OllamaAdapter;
  let isOllamaAvailable = false;
  let availableModel: string | undefined;

  beforeAll(async () => {
    // Use environment variables or defaults
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const defaultModel = process.env.OLLAMA_MODEL || 'llama2';

    adapter = new OllamaAdapter({ host, defaultModel });

    // Check if Ollama is available
    const healthCheck = await adapter.healthCheck();
    isOllamaAvailable = healthCheck.healthy;

    if (isOllamaAvailable) {
      // Try to get available models to use for testing
      try {
        const models = await adapter.getModels();
        if (models.length > 0) {
          availableModel = models[0].id;
        }
      } catch {
        // If we can't get models, use the default
        availableModel = defaultModel;
      }
    }

    if (!isOllamaAvailable) {
      console.warn(
        '⚠️  Ollama integration tests skipped: Ollama not available'
      );
      console.warn(`   Health check failed: ${healthCheck.error}`);
      console.warn(
        '   To run these tests, ensure Ollama is running and accessible'
      );
    }
  });

  describe('health check', () => {
    it('should check Ollama availability', async () => {
      const result = await adapter.healthCheck();

      if (isOllamaAvailable) {
        expect(result.healthy).toBe(true);
        expect(result.error).toBeUndefined();
      } else {
        expect(result.healthy).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('model listing', () => {
    it.skipIf(!isOllamaAvailable)('should fetch available models', async () => {
      const models = await adapter.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Check model structure
      const firstModel = models[0];
      expect(firstModel).toHaveProperty('id');
      expect(firstModel).toHaveProperty('name');
      expect(firstModel).toHaveProperty('capabilities');
      expect(firstModel.capabilities.chat).toBe(true);
      expect(firstModel.capabilities.embeddings).toBe(true);
    });
  });

  describe('chat functionality', () => {
    it.skipIf(!isOllamaAvailable || !availableModel)(
      'should perform chat completion',
      async () => {
        const params: ChatParams = {
          model: availableModel,
          messages: [
            { role: 'user', content: 'Say "Hello, Entole!" and nothing else.' },
          ],
          temperature: 0.1, // Low temperature for more predictable output
          max_tokens: 50,
        };

        const response = await adapter.invokeChat(params);

        expect(response).toHaveProperty('text');
        expect(typeof response.text).toBe('string');
        expect(response.text.length).toBeGreaterThan(0);

        expect(response.meta).toHaveProperty('model');
        expect(response.meta?.model).toBe(availableModel);

        if (response.meta?.usage) {
          expect(response.meta.usage.total_tokens).toBeGreaterThan(0);
        }
      },
      30000
    ); // 30 second timeout for slow models

    it.skipIf(!isOllamaAvailable || !availableModel)(
      'should handle streaming chat',
      async () => {
        const params: ChatParams = {
          model: availableModel,
          messages: [
            {
              role: 'user',
              content: 'Count from 1 to 3, one number per response.',
            },
          ],
          temperature: 0.1,
          max_tokens: 20,
        };

        const chunks = [];
        let totalContent = '';

        for await (const chunk of adapter.invokeChatStream(params)) {
          chunks.push(chunk);
          totalContent += chunk.delta;

          expect(chunk).toHaveProperty('delta');
          expect(typeof chunk.delta).toBe('string');
          expect(chunk).toHaveProperty('done');
          expect(chunk.meta).toHaveProperty('model');

          // Break early if we get a reasonable amount of content
          if (chunks.length > 10 || chunk.done) {
            break;
          }
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(totalContent.length).toBeGreaterThan(0);
      },
      30000
    );
  });

  describe('embeddings functionality', () => {
    it.skipIf(!isOllamaAvailable || !availableModel)(
      'should generate embeddings for single input',
      async () => {
        const params: EmbeddingParams = {
          model: availableModel,
          input: 'Hello, world!',
        };

        const response = await adapter.invokeEmbeddings(params);

        expect(response).toHaveProperty('vectors');
        expect(Array.isArray(response.vectors)).toBe(true);
        expect(response.vectors.length).toBe(1);

        const vector = response.vectors[0];
        expect(Array.isArray(vector)).toBe(true);
        expect(vector.length).toBeGreaterThan(0);
        expect(vector.every((n) => typeof n === 'number')).toBe(true);

        expect(response.meta).toHaveProperty('model');
        expect(response.meta?.model).toBe(availableModel);
      },
      30000
    );

    it.skipIf(!isOllamaAvailable || !availableModel)(
      'should generate embeddings for multiple inputs',
      async () => {
        const params: EmbeddingParams = {
          model: availableModel,
          input: ['Hello', 'World'],
        };

        const response = await adapter.invokeEmbeddings(params);

        expect(response.vectors.length).toBe(2);

        // Both vectors should have the same dimensionality
        const firstVector = response.vectors[0];
        const secondVector = response.vectors[1];
        expect(firstVector.length).toBe(secondVector.length);
        expect(firstVector.length).toBeGreaterThan(0);
      },
      30000
    );
  });

  describe('error handling', () => {
    it.skipIf(!isOllamaAvailable)(
      'should handle invalid model gracefully',
      async () => {
        const params: ChatParams = {
          model: 'nonexistent-model-12345',
          messages: [{ role: 'user', content: 'Hello' }],
        };

        await expect(adapter.invokeChat(params)).rejects.toMatchObject({
          provider: 'ollama',
          type: expect.any(String),
          message: expect.any(String),
          retryable: expect.any(Boolean),
        });
      }
    );
  });
});
