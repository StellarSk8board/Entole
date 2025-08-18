/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Provider registry for managing and resolving AI provider adapters
 */

import type { ProviderAdapter, CapabilityFlags } from '../types.js';

/**
 * Registry of all available provider adapters
 *
 * @example
 * ```typescript
 * import { ProviderRegistry, OpenAIAdapter } from 'entole';
 *
 * const registry = new ProviderRegistry();
 * registry.register(new OpenAIAdapter({ apiKey: 'sk-...' }));
 *
 * const provider = registry.resolve('openai', 'chat');
 * const response = await provider.invokeChat({
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();
  private initialized = false;

  /**
   * Register a provider adapter
   *
   * @param adapter - The provider adapter to register
   *
   * @example
   * ```typescript
   * const registry = new ProviderRegistry();
   * registry.register(new OpenAIAdapter({ apiKey: 'sk-...' }));
   * ```
   */
  register(adapter: ProviderAdapter): void {
    this.providers.set(adapter.key, adapter);
  }

  /**
   * Get a provider adapter by key
   */
  get(key: string): ProviderAdapter | undefined {
    this.ensureInitialized();
    return this.providers.get(key);
  }

  /**
   * Get all registered provider keys
   */
  getKeys(): string[] {
    this.ensureInitialized();
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers
   */
  getAll(): ProviderAdapter[] {
    this.ensureInitialized();
    return Array.from(this.providers.values());
  }

  /**
   * Check if a provider is registered
   */
  has(key: string): boolean {
    this.ensureInitialized();
    return this.providers.has(key);
  }

  /**
   * Get providers that support a specific capability
   */
  getByCapability(capability: keyof CapabilityFlags): ProviderAdapter[] {
    this.ensureInitialized();
    return Array.from(this.providers.values()).filter(
      (provider) => provider.capabilities[capability]
    );
  }

  /**
   * Resolve a provider with fallback logic
   *
   * @param preferredProvider - Specific provider key to use (optional)
   * @param capability - Required capability the provider must support (optional)
   * @returns The resolved provider adapter
   * @throws Error if no suitable provider is found
   *
   * @example
   * ```typescript
   * // Get specific provider
   * const openai = registry.resolve('openai');
   *
   * // Get any provider that supports chat
   * const chatProvider = registry.resolve(undefined, 'chat');
   *
   * // Get specific provider with capability check
   * const openaiChat = registry.resolve('openai', 'chat');
   * ```
   */
  resolve(
    preferredProvider?: string,
    capability?: keyof CapabilityFlags
  ): ProviderAdapter {
    this.ensureInitialized();

    // If a specific provider is requested, try to use it
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (!provider) {
        throw new Error(`Provider '${preferredProvider}' is not available`);
      }

      // Check if the provider supports the required capability
      if (capability && !provider.capabilities[capability]) {
        throw new Error(
          `Provider '${preferredProvider}' does not support ${capability}`
        );
      }

      return provider;
    }

    // If no specific provider requested, find one that supports the capability
    if (capability) {
      const supportingProviders = this.getByCapability(capability);
      if (supportingProviders.length === 0) {
        throw new Error(`No providers available that support ${capability}`);
      }

      // Return the first available provider that supports the capability
      // In the future, this could be enhanced with priority/preference logic
      return supportingProviders[0];
    }

    // If no capability specified, return any available provider
    const allProviders = this.getAll();
    if (allProviders.length === 0) {
      throw new Error('No providers are available');
    }

    return allProviders[0];
  }

  /**
   * Validate that a provider supports required capabilities
   */
  validateCapabilities(
    providerKey: string,
    requiredCapabilities: (keyof CapabilityFlags)[]
  ): void {
    const provider = this.get(providerKey);
    if (!provider) {
      throw new Error(`Provider '${providerKey}' is not available`);
    }

    const unsupported = requiredCapabilities.filter(
      (capability) => !provider.capabilities[capability]
    );

    if (unsupported.length > 0) {
      throw new Error(
        `Provider '${providerKey}' does not support: ${unsupported.join(', ')}`
      );
    }
  }

  /**
   * Get provider information for display purposes
   */
  getProviderInfo(): Array<{
    key: string;
    label: string;
    capabilities: CapabilityFlags;
  }> {
    this.ensureInitialized();
    return Array.from(this.providers.values()).map((provider) => ({
      key: provider.key,
      label: provider.label,
      capabilities: provider.capabilities,
    }));
  }

  /**
   * Clear all registered providers (mainly for testing)
   */
  clear(): void {
    this.providers.clear();
    this.initialized = false;
  }

  /**
   * Lazy initialization of providers
   */
  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    // Register all available providers
    // Note: Actual provider implementations will be registered when they're imported
    // This is a placeholder for the initialization pattern
    this.initialized = true;
  }
}

/**
 * Global provider registry instance
 */
export const providerRegistry = new ProviderRegistry();

/**
 * Convenience function to register a provider
 */
export function registerProvider(adapter: ProviderAdapter): void {
  providerRegistry.register(adapter);
}

/**
 * Convenience function to get a provider
 */
export function getProvider(key: string): ProviderAdapter | undefined {
  return providerRegistry.get(key);
}

/**
 * Convenience function to resolve a provider with fallback logic
 */
export function resolveProvider(
  preferredProvider?: string,
  capability?: keyof CapabilityFlags
): ProviderAdapter {
  return providerRegistry.resolve(preferredProvider, capability);
}

/**
 * Convenience function to get all provider information
 */
export function getProviderInfo(): Array<{
  key: string;
  label: string;
  capabilities: CapabilityFlags;
}> {
  return providerRegistry.getProviderInfo();
}
