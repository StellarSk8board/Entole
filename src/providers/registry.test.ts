/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for provider registry functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from './registry.js';
import type { ProviderAdapter, CapabilityFlags } from '../types.js';

// Mock provider adapter for testing
class MockProviderAdapter implements ProviderAdapter {
  constructor(
    public readonly key: string,
    public readonly label: string,
    public readonly capabilities: CapabilityFlags
  ) {}

  async invokeChat() {
    throw new Error('Not implemented');
  }

  async *invokeChatStream() {
    // This yield is needed to satisfy TypeScript's generator requirements
    yield { delta: '', done: true };
    throw new Error('Not implemented');
  }

  async invokeEmbeddings() {
    throw new Error('Not implemented');
  }

  async getModels() {
    return [];
  }

  normalizeError(error: unknown) {
    return {
      provider: this.key,
      type: 'internal' as const,
      message: String(error),
      retryable: false,
    };
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  let mockChatProvider: MockProviderAdapter;
  let mockEmbeddingProvider: MockProviderAdapter;
  let mockFullProvider: MockProviderAdapter;

  beforeEach(() => {
    registry = new ProviderRegistry();

    mockChatProvider = new MockProviderAdapter(
      'mock-chat',
      'Mock Chat Provider',
      { chat: true, embeddings: false, image: false, tools: false }
    );

    mockEmbeddingProvider = new MockProviderAdapter(
      'mock-embed',
      'Mock Embedding Provider',
      { chat: false, embeddings: true, image: false, tools: false }
    );

    mockFullProvider = new MockProviderAdapter(
      'mock-full',
      'Mock Full Provider',
      { chat: true, embeddings: true, image: false, tools: false }
    );
  });

  describe('register and get', () => {
    it('should register and retrieve providers', () => {
      registry.register(mockChatProvider);

      const retrieved = registry.get('mock-chat');
      expect(retrieved).toBe(mockChatProvider);
    });

    it('should return undefined for non-existent providers', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered providers', () => {
      registry.register(mockChatProvider);
      expect(registry.has('mock-chat')).toBe(true);
    });

    it('should return false for non-registered providers', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getKeys and getAll', () => {
    it('should return all registered provider keys', () => {
      registry.register(mockChatProvider);
      registry.register(mockEmbeddingProvider);

      const keys = registry.getKeys();
      expect(keys).toContain('mock-chat');
      expect(keys).toContain('mock-embed');
      expect(keys).toHaveLength(2);
    });

    it('should return all registered providers', () => {
      registry.register(mockChatProvider);
      registry.register(mockEmbeddingProvider);

      const providers = registry.getAll();
      expect(providers).toContain(mockChatProvider);
      expect(providers).toContain(mockEmbeddingProvider);
      expect(providers).toHaveLength(2);
    });
  });

  describe('getByCapability', () => {
    beforeEach(() => {
      registry.register(mockChatProvider);
      registry.register(mockEmbeddingProvider);
      registry.register(mockFullProvider);
    });

    it('should return providers that support chat', () => {
      const chatProviders = registry.getByCapability('chat');
      expect(chatProviders).toContain(mockChatProvider);
      expect(chatProviders).toContain(mockFullProvider);
      expect(chatProviders).not.toContain(mockEmbeddingProvider);
      expect(chatProviders).toHaveLength(2);
    });

    it('should return providers that support embeddings', () => {
      const embeddingProviders = registry.getByCapability('embeddings');
      expect(embeddingProviders).toContain(mockEmbeddingProvider);
      expect(embeddingProviders).toContain(mockFullProvider);
      expect(embeddingProviders).not.toContain(mockChatProvider);
      expect(embeddingProviders).toHaveLength(2);
    });

    it('should return empty array for unsupported capabilities', () => {
      const imageProviders = registry.getByCapability('image');
      expect(imageProviders).toHaveLength(0);
    });
  });

  describe('resolve', () => {
    beforeEach(() => {
      registry.register(mockChatProvider);
      registry.register(mockEmbeddingProvider);
      registry.register(mockFullProvider);
    });

    it('should resolve specific provider when requested', () => {
      const resolved = registry.resolve('mock-chat');
      expect(resolved).toBe(mockChatProvider);
    });

    it('should throw error for non-existent provider', () => {
      expect(() => registry.resolve('non-existent')).toThrow(
        "Provider 'non-existent' is not available"
      );
    });

    it('should resolve provider by capability', () => {
      const resolved = registry.resolve(undefined, 'chat');
      expect([mockChatProvider, mockFullProvider]).toContain(resolved);
    });

    it('should throw error when provider does not support capability', () => {
      expect(() => registry.resolve('mock-chat', 'embeddings')).toThrow(
        "Provider 'mock-chat' does not support embeddings"
      );
    });

    it('should throw error when no providers support capability', () => {
      expect(() => registry.resolve(undefined, 'image')).toThrow(
        'No providers available that support image'
      );
    });

    it('should return any provider when no specific requirements', () => {
      const resolved = registry.resolve();
      expect([
        mockChatProvider,
        mockEmbeddingProvider,
        mockFullProvider,
      ]).toContain(resolved);
    });

    it('should throw error when no providers are available', () => {
      const emptyRegistry = new ProviderRegistry();
      expect(() => emptyRegistry.resolve()).toThrow(
        'No providers are available'
      );
    });
  });

  describe('validateCapabilities', () => {
    beforeEach(() => {
      registry.register(mockChatProvider);
      registry.register(mockFullProvider);
    });

    it('should pass validation for supported capabilities', () => {
      expect(() => {
        registry.validateCapabilities('mock-full', ['chat', 'embeddings']);
      }).not.toThrow();
    });

    it('should throw error for unsupported capabilities', () => {
      expect(() => {
        registry.validateCapabilities('mock-chat', ['chat', 'embeddings']);
      }).toThrow("Provider 'mock-chat' does not support: embeddings");
    });

    it('should throw error for non-existent provider', () => {
      expect(() => {
        registry.validateCapabilities('non-existent', ['chat']);
      }).toThrow("Provider 'non-existent' is not available");
    });
  });

  describe('getProviderInfo', () => {
    it('should return provider information for display', () => {
      registry.register(mockChatProvider);
      registry.register(mockEmbeddingProvider);

      const info = registry.getProviderInfo();
      expect(info).toHaveLength(2);

      const chatInfo = info.find((p) => p.key === 'mock-chat');
      expect(chatInfo).toEqual({
        key: 'mock-chat',
        label: 'Mock Chat Provider',
        capabilities: {
          chat: true,
          embeddings: false,
          image: false,
          tools: false,
        },
      });
    });
  });

  describe('clear', () => {
    it('should clear all registered providers', () => {
      registry.register(mockChatProvider);
      registry.register(mockEmbeddingProvider);

      expect(registry.getAll()).toHaveLength(2);

      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
    });
  });
});
