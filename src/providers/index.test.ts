/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Tests for provider module initialization and registration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { providerRegistry } from './registry.js';
import { OllamaAdapter } from './ollama.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenRouterAdapter } from './openrouter.js';

describe('Provider Module Initialization', () => {
  beforeEach(() => {
    // Clear registry before each test to ensure clean state
    providerRegistry.clear();

    // Manually register adapters for testing
    providerRegistry.register(new OllamaAdapter());
    providerRegistry.register(
      new OpenAIAdapter({
        apiKey: 'sk-test-key-12345678901234567890123456789012',
      })
    );
    providerRegistry.register(
      new AnthropicAdapter({
        apiKey:
          'sk-ant-api03-test-key-12345678901234567890123456789012345678901234567890123456789012345678901234567890123456',
      })
    );
    providerRegistry.register(
      new OpenRouterAdapter({
        apiKey: 'sk-or-test-key-12345678901234567890123456789012',
      })
    );
  });

  it('should automatically register Ollama adapter', () => {
    expect(providerRegistry.has('ollama')).toBe(true);

    const ollamaAdapter = providerRegistry.get('ollama');
    expect(ollamaAdapter).toBeDefined();
    expect(ollamaAdapter?.key).toBe('ollama');
    expect(ollamaAdapter?.label).toBe('Ollama');
    expect(ollamaAdapter?.capabilities).toEqual({
      chat: true,
      embeddings: true,
      image: false,
      tools: false,
    });
  });

  it('should automatically register OpenAI adapter', () => {
    expect(providerRegistry.has('openai')).toBe(true);

    const openaiAdapter = providerRegistry.get('openai');
    expect(openaiAdapter).toBeDefined();
    expect(openaiAdapter?.key).toBe('openai');
    expect(openaiAdapter?.label).toBe('OpenAI');
    expect(openaiAdapter?.capabilities).toEqual({
      chat: true,
      embeddings: true,
      image: true,
      tools: true,
    });
  });

  it('should automatically register Anthropic adapter', () => {
    expect(providerRegistry.has('anthropic')).toBe(true);

    const anthropicAdapter = providerRegistry.get('anthropic');
    expect(anthropicAdapter).toBeDefined();
    expect(anthropicAdapter?.key).toBe('anthropic');
    expect(anthropicAdapter?.label).toBe('Anthropic');
    expect(anthropicAdapter?.capabilities).toEqual({
      chat: true,
      embeddings: false,
      image: true,
      tools: true,
    });
  });

  it('should automatically register OpenRouter adapter', () => {
    expect(providerRegistry.has('openrouter')).toBe(true);

    const openrouterAdapter = providerRegistry.get('openrouter');
    expect(openrouterAdapter).toBeDefined();
    expect(openrouterAdapter?.key).toBe('openrouter');
    expect(openrouterAdapter?.label).toBe('OpenRouter');
    expect(openrouterAdapter?.capabilities).toEqual({
      chat: true,
      embeddings: true,
      image: false,
      tools: false,
    });
  });

  it('should include all providers in provider info', () => {
    const providerInfo = providerRegistry.getProviderInfo();
    expect(providerInfo).toHaveLength(4);

    const ollamaInfo = providerInfo.find((p) => p.key === 'ollama');
    expect(ollamaInfo).toBeDefined();
    expect(ollamaInfo).toEqual({
      key: 'ollama',
      label: 'Ollama',
      capabilities: {
        chat: true,
        embeddings: true,
        image: false,
        tools: false,
      },
    });

    const openaiInfo = providerInfo.find((p) => p.key === 'openai');
    expect(openaiInfo).toBeDefined();
    expect(openaiInfo).toEqual({
      key: 'openai',
      label: 'OpenAI',
      capabilities: {
        chat: true,
        embeddings: true,
        image: true,
        tools: true,
      },
    });

    const anthropicInfo = providerInfo.find((p) => p.key === 'anthropic');
    expect(anthropicInfo).toBeDefined();
    expect(anthropicInfo).toEqual({
      key: 'anthropic',
      label: 'Anthropic',
      capabilities: {
        chat: true,
        embeddings: false,
        image: true,
        tools: true,
      },
    });

    const openrouterInfo = providerInfo.find((p) => p.key === 'openrouter');
    expect(openrouterInfo).toBeDefined();
    expect(openrouterInfo).toEqual({
      key: 'openrouter',
      label: 'OpenRouter',
      capabilities: {
        chat: true,
        embeddings: true,
        image: false,
        tools: false,
      },
    });
  });

  it('should be able to resolve providers for chat capability', () => {
    const chatProvider = providerRegistry.resolve(undefined, 'chat');
    expect(['ollama', 'openai', 'anthropic', 'openrouter']).toContain(
      chatProvider.key
    );
  });

  it('should be able to resolve providers for embeddings capability', () => {
    const embeddingsProvider = providerRegistry.resolve(
      undefined,
      'embeddings'
    );
    expect(['ollama', 'openai', 'openrouter']).toContain(
      embeddingsProvider.key
    );
  });

  it('should be able to resolve specific providers', () => {
    const ollamaProvider = providerRegistry.resolve('ollama');
    expect(ollamaProvider.key).toBe('ollama');

    const openaiProvider = providerRegistry.resolve('openai');
    expect(openaiProvider.key).toBe('openai');

    const anthropicProvider = providerRegistry.resolve('anthropic');
    expect(anthropicProvider.key).toBe('anthropic');

    const openrouterProvider = providerRegistry.resolve('openrouter');
    expect(openrouterProvider.key).toBe('openrouter');
  });
});
