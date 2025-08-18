/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Cohere provider adapter stub - not yet implemented
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
 * Cohere provider adapter configuration
 */
export interface CohereConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Cohere provider adapter stub - throws not implemented errors
 */
export class CohereAdapter extends BaseProviderAdapter {
  readonly key = 'cohere';
  readonly label = 'Cohere';
  readonly capabilities: CapabilityFlags = {
    chat: false,
    embeddings: false,
    image: false,
    tools: false,
  };

  constructor(_config: CohereConfig = {}) {
    super();
  }

  /**
   * Chat is not yet implemented for Cohere
   */
  async invokeChat(_params: ChatParams): Promise<ChatResponse> {
    throw createNotImplementedError(this.key, 'chat');
  }

  /**
   * Streaming chat is not yet implemented for Cohere
   */
  async *invokeChatStream(_params: ChatParams): AsyncIterable<ChatStreamChunk> {
    // This yield is needed to satisfy TypeScript's generator requirements
    yield { delta: '', done: true };
    throw createNotImplementedError(this.key, 'streaming chat');
  }

  /**
   * Embeddings are not yet implemented for Cohere
   */
  async invokeEmbeddings(_params: EmbeddingParams): Promise<EmbeddingResponse> {
    throw createNotImplementedError(this.key, 'embeddings');
  }

  /**
   * Model listing is not yet implemented for Cohere
   */
  async getModels(): Promise<ModelInfo[]> {
    return [];
  }
}
