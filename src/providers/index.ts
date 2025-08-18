/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Provider module exports and registration
 */

export * from './types.js';
export * from './base.js';
export * from './registry.js';
export * from './ollama.js';
export * from './openai.js';
export * from './anthropic.js';
export * from './openrouter.js';
export * from './mistral.js';
export * from './cohere.js';

// Register all available providers
import { OllamaAdapter } from './ollama.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { OpenRouterAdapter } from './openrouter.js';
import { MistralAdapter } from './mistral.js';
import { CohereAdapter } from './cohere.js';
import { registerProvider } from './registry.js';

// Initialize and register providers
function initializeProviders(): void {
  // Register Ollama adapter
  registerProvider(new OllamaAdapter());

  // Register OpenAI adapter
  registerProvider(new OpenAIAdapter());

  // Register Anthropic adapter
  registerProvider(new AnthropicAdapter());

  // Register OpenRouter adapter
  registerProvider(new OpenRouterAdapter());

  // Register stub adapters
  registerProvider(new MistralAdapter());
  registerProvider(new CohereAdapter());
}

// Auto-initialize providers when module is imported
initializeProviders();
