/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Mistral provider adapter stub - not yet implemented
 */

import type {
  CapabilityFlags,
  ChatParams,
  ChatResponse,
  ChatStreamChunk,
  EmbeddingParams,
  EmbeddingResponse,
  ModelInfo,
} from '../types.js';
import { BaseProviderAdapter } from './base.js';
import { createNotImplementedError } from './types.js';

/**
 * Mistral provider adapter configuration
 */
export interface MistralConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Mistral provider adapter stub - throws not implemented errors
 */
export class MistralAdapter extends BaseProviderAdapter {
  readonly key = 'mistral';
  readonly label = 'Mistral';
  readonly capabilities: CapabilityFlags = {
    chat: false,
    embeddings: false,
    image: false,
    tools: false,
  };

  constructor(_config: MistralConfig = {}) {
    super();
  }

  /**
   * Chat is not yet implemented for Mistral
   */
  async invokeChat(_params: ChatParams): Promise<ChatResponse> {
    throw createNotImplementedError(this.key, 'chat');
  }

  /**
   * Streaming chat is not yet implemented for Mistral
   */
  async *invokeChatStream(_params: ChatParams): AsyncIterable<ChatStreamChunk> {
    // This yield is needed to satisfy TypeScript's generator requirements
    yield { delta: '', done: true };
    throw createNotImplementedError(this.key, 'streaming chat');
  }

  /**
   * Embeddings are not yet implemented for Mistral
   */
  async invokeEmbeddings(_params: EmbeddingParams): Promise<EmbeddingResponse> {
    throw createNotImplementedError(this.key, 'embeddings');
  }

  /**
   * Model listing is not yet implemented for Mistral
   */
  async getModels(): Promise<ModelInfo[]> {
    return [];
  }
}
